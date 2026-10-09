<?php
/* The membership application (membership page): the company's details, and its stamp as a picture or PDF
   (optional, up to 5 MB), as server/src/api.ts checks them. The stamp is kept with the submissions, outside the
   web root, and attached to the e-mail. */
require __DIR__ . '/_lib.php';
begin('membership');

const TYPES = ['Member', 'Associate Member'];
const SECTORS = ['Tannery', 'Shoe Manufacturer', 'Leather Product Manufacturer'];
const MAX_STAMP = 5 * 1024 * 1024;

$d = [
    'companyName'        => field('companyName', 200),
    'generalManager'     => field('generalManager', 120),
    'yearEstablished'    => field('yearEstablished', 4),
    'membershipType'     => field('membershipType', 40),
    'region'             => field('region', 80),
    'subCity'            => field('subCity', 80),
    'wereda'             => field('wereda', 40),
    'houseNo'            => field('houseNo', 40),
    'tel'                => field('tel', 40),
    'mobile'             => field('mobile', 40),
    'email'              => strtolower(field('email', 160)),
    'website'            => field('website', 200),
    'sector'             => field('sector', 60),
    'employeesMale'      => count_field('employeesMale'),
    'employeesFemale'    => count_field('employeesFemale'),
    'employeesPermanent' => count_field('employeesPermanent'),
    'employeesTemporary' => count_field('employeesTemporary'),
    'bankAccount'        => field('bankAccount', 80),
];
$err = [];
foreach (['companyName', 'generalManager', 'region', 'mobile'] as $k) if ($d[$k] === '') $err[$k] = 'Required';
if (!valid_email($d['email'])) $err['email'] = 'Enter a valid e-mail address';
$year = (int) date('Y');
if (!ctype_digit($d['yearEstablished']) || (int) $d['yearEstablished'] < 1900 || (int) $d['yearEstablished'] > $year) {
    $err['yearEstablished'] = 'Enter a year from 1900 to ' . $year;
}
if (!in_array($d['membershipType'], TYPES, true)) $err['membershipType'] = 'Choose one';
if (!in_array($d['sector'], SECTORS, true)) $err['sector'] = 'Choose one';
foreach (['employeesMale', 'employeesFemale', 'employeesPermanent', 'employeesTemporary'] as $k) {
    if ($d[$k] === null) { $err[$k] = 'Enter a whole number'; $d[$k] = ''; }
}
if (field('consent', 10) !== 'true') $err['consent'] = 'Please accept the membership terms';

/* the stamp: optional; a picture (PNG, JPG, WebP) or a PDF, recognised by its first bytes, not its name */
$stamp = null;
$f = $_FILES['stamp'] ?? null;
if ($f && is_array($f) && ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $e = (int) $f['error'];
    if ($e === UPLOAD_ERR_INI_SIZE || $e === UPLOAD_ERR_FORM_SIZE || (int) ($f['size'] ?? 0) > MAX_STAMP) {
        $mb = max_upload_mb(5);
        finish(413, ['error' => 'The stamp file must be under ' . $mb . ' MB.', 'fields' => ['stamp' => 'Max ' . $mb . ' MB']]);
    }
    if ($e !== UPLOAD_ERR_OK || !is_uploaded_file((string) $f['tmp_name'])) {
        $err['stamp'] = 'The file did not arrive. Please try again';
    } else {
        $head = (string) file_get_contents((string) $f['tmp_name'], false, null, 0, 16);
        $kinds = [
            'png'  => ["\x89PNG", 'image/png'],
            'jpg'  => ["\xFF\xD8\xFF", 'image/jpeg'],
            'pdf'  => ['%PDF-', 'application/pdf'],
        ];
        foreach ($kinds as $ext => $k) if (strncmp($head, $k[0], strlen($k[0])) === 0) $stamp = ['ext' => $ext, 'type' => $k[1]];
        if (!$stamp && substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP') $stamp = ['ext' => 'webp', 'type' => 'image/webp'];
        if (!$stamp) $err['stamp'] = 'Use a PNG, JPG, WebP or PDF file';
    }
}
if ($err) finish(422, ['error' => 'Please check the highlighted fields.', 'fields' => $err]);

$files = [];
$d['stamp'] = '';
if ($stamp) {
    $dir = data_dir() . '/stamps';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $stamp['ext'];
    if (@move_uploaded_file((string) $f['tmp_name'], $dir . '/' . $name)) {
        @chmod($dir . '/' . $name, 0600);
        $d['stamp'] = $name;
        $files[] = ['path' => $dir . '/' . $name, 'name' => 'stamp-' . $name, 'type' => $stamp['type']];
    }
}
$d['consent'] = 'Accepted';

deliver('membership.csv', 'Membership application · ' . $d['companyName'], $d, $d['email'], $files);
