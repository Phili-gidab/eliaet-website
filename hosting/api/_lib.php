<?php
/* Shared by the site's forms on PHP hosting (contact.php, appointments.php, subscribe.php, membership.php).
   They answer exactly like the site's Node server (server/src/api.ts), so the pages' script works with either:
   201 {ok, id} when it is in, 422 {error, fields} when a field needs another look.
   Here: reading what was sent (JSON from the pages' script, or a form with a file), checking it, keeping it in CSV
   files outside the web root, limiting how often one visitor can send, and e-mailing it. PHP 7.2 and newer. */

declare(strict_types=1);
date_default_timezone_set('Africa/Addis_Ababa');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function cfg(string $key)
{
    static $c = null;
    if ($c === null) $c = require __DIR__ . '/_config.php';
    return $c[$key] ?? null;
}

/* ---- answering ------------------------------------------------------------------------------------------------ */

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function wants_json(): bool
{
    return strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;
}

/** Back to the page the form was on (same site only), for a browser without the pages' script. */
function back_url(): string
{
    $ref = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $p = parse_url($ref);
    if ($ref !== '' && $p && ($p['host'] ?? '') === $host) return ($p['path'] ?? '/') . (isset($p['query']) ? '?' . $p['query'] : '');
    return '/';
}

/** Ends the request: JSON for the pages' script; a short page for a browser that posted the form without it. */
function finish(int $code, array $data): void
{
    http_response_code($code);
    if (wants_json()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    $ok = $code < 400;
    $title = $ok ? 'Thank you' : 'Please check the form';
    $msg = $ok ? 'We have received it.' : (string) ($data['error'] ?? 'Something went wrong.');
    $items = '';
    foreach (($data['fields'] ?? []) as $k => $v) $items .= '<li>' . h(label((string) $k)) . ': ' . h((string) $v) . '</li>';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<meta name="robots" content="noindex"><title>' . h($title) . ' · ELIA</title></head>'
       . '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0907;color:#f5ecdf;font:17px/1.55 system-ui,sans-serif">'
       . '<main style="max-width:34rem;padding:32px 24px"><h1 style="font-size:2rem;line-height:1.1;margin:0 0 14px">' . h($title) . '</h1>'
       . '<p style="margin:0">' . h($msg) . '</p>' . ($items ? '<ul style="margin:14px 0 0;padding-left:1.2em">' . $items . '</ul>' : '')
       . '<p style="margin-top:28px"><a style="color:#f6b74b" href="' . h(back_url()) . '">Back to the site</a></p></main></body></html>';
    exit;
}

/* ---- reading what was sent -------------------------------------------------------------------------------------- */

/** The fields: a JSON body (the pages' script sends the simple forms as JSON) or ordinary form fields. */
function input(): array
{
    static $in = null;
    if ($in !== null) return $in;
    $in = [];
    if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== false) {
        $raw = file_get_contents('php://input', false, null, 0, 200000);
        $j = json_decode((string) $raw, true);
        if (is_array($j)) $in = $j;
    } else {
        $in = $_POST;
    }
    return $in;
}

function raw(string $name): string
{
    $v = input()[$name] ?? '';
    if (is_int($v) || is_float($v)) return (string) $v;
    return is_string($v) ? $v : '';
}

function cut(string $v, int $max): string
{
    return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}

/** One line of text: trimmed, no control characters or line breaks, at most $max characters. */
function field(string $name, int $max = 200): string
{
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', raw($name)) ?? '';
    $v = preg_replace('/\s+/u', ' ', $v) ?? '';
    return cut(trim($v), $max);
}

/** A message: keeps its line breaks. */
function text_field(string $name, int $max = 5000): string
{
    $v = str_replace(["\r\n", "\r"], "\n", raw($name));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return cut(trim($v), $max);
}

function valid_email(string $e): bool
{
    return strlen($e) <= 160 && filter_var($e, FILTER_VALIDATE_EMAIL) !== false && !preg_match('/[\r\n,;<>"]/', $e);
}

/** A head count: blank is "not given"; otherwise a whole number. Returns null when it is not one. */
function count_field(string $name): ?string
{
    $v = field($name, 9);
    if ($v === '') return '';
    return ctype_digit($v) && (int) $v <= 1000000 ? (string) (int) $v : null;
}

/** How each field is called in the e-mails and on the plain-form answer page. */
function label(string $k): string
{
    $names = [
        'name' => 'Name', 'email' => 'E-mail', 'subject' => 'Subject', 'message' => 'Message', 'mobile' => 'Mobile',
        'sector' => 'Sector', 'date' => 'Date', 'companyName' => 'Company', 'generalManager' => 'General manager',
        'yearEstablished' => 'Year established', 'membershipType' => 'Membership', 'region' => 'Region',
        'subCity' => 'Sub-city', 'wereda' => 'Wereda', 'houseNo' => 'House no.', 'tel' => 'Telephone',
        'website' => 'Website', 'employeesMale' => 'Employees, male', 'employeesFemale' => 'Employees, female',
        'employeesPermanent' => 'Employees, permanent', 'employeesTemporary' => 'Employees, temporary',
        'bankAccount' => 'Bank account', 'consent' => 'Consent', 'stamp' => 'Company stamp', 'id' => 'Reference',
        'received' => 'Received',
    ];
    return $names[$k] ?? $k;
}

/* ---- the start of every form ----------------------------------------------------------------------------------- */

/** A PHP size setting ("8M") in bytes. */
function ini_bytes(string $v): int
{
    $v = trim($v);
    $n = (int) $v;
    $unit = strtolower(substr($v, -1));
    if ($unit === 'g') $n *= 1024 * 1024 * 1024;
    elseif ($unit === 'm') $n *= 1024 * 1024;
    elseif ($unit === 'k') $n *= 1024;
    return $n;
}

/** The largest file the server takes, in MB, up to $cap. */
function max_upload_mb(int $cap): int
{
    $limits = array_filter([ini_bytes((string) ini_get('upload_max_filesize')), ini_bytes((string) ini_get('post_max_size'))]);
    $bytes = $limits ? min($cap * 1024 * 1024, min($limits)) : $cap * 1024 * 1024;
    return max(1, (int) floor($bytes / (1024 * 1024)));
}

/** POST only; a robot (it fills the hidden website_url field) gets a normal-looking answer; then the hourly limit. */
function begin(string $form): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        finish(405, ['error' => 'Not found']);
    }
    // more than the server takes: PHP drops the whole form, so say what happened instead of "Required" everywhere
    $post_max = ini_bytes((string) ini_get('post_max_size'));
    if ($post_max > 0 && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $post_max) {
        finish(413, ['error' => 'The file is too large. Please send one under ' . max_upload_mb(5) . ' MB.', 'fields' => ['stamp' => 'Too large']]);
    }
    if (field('website_url', 500) !== '') finish(201, ['ok' => true]);
    if (!rate_ok($form)) {
        finish(429, ['error' => 'Too many sends from this connection. Please try again in an hour, or e-mail ' . cfg('contact_email') . '.']);
    }
}

function new_id(): string
{
    return bin2hex(random_bytes(8));
}

/* ---- where the submissions are kept ------------------------------------------------------------------------------- */

function data_dir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;
    $want = (string) cfg('data_dir');
    if (@is_dir($want) || @mkdir($want, 0700, true)) return $dir = $want;
    // the home folder is not writable: keep the data next to the forms, closed to the web (see .htaccess)
    $dir = __DIR__ . '/_data';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    return $dir;
}

/** A spreadsheet cell can't start a formula (=, +, -, @) when the file is opened in Excel. */
function csv_safe($v): string
{
    $v = (string) $v;
    return ($v !== '' && strpbrk($v[0], "=+-@\t\r") !== false) ? "'" . $v : $v;
}

function csv_append(string $file, array $row): bool
{
    $path = data_dir() . '/' . $file;
    $new = !is_file($path);
    $fh = @fopen($path, 'ab');
    if (!$fh) return false;
    flock($fh, LOCK_EX);
    if ($new) {
        fwrite($fh, "\xEF\xBB\xBF");                       // so Excel reads the Amharic and the accents correctly
        fputcsv($fh, array_map('label', array_keys($row)), ',', '"', '\\');
    }
    fputcsv($fh, array_map('csv_safe', array_values($row)), ',', '"', '\\');
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    @chmod($path, 0600);
    return true;
}

/* ---- how often one visitor may send ----------------------------------------------------------------------------- */

function rate_ok(string $form): bool
{
    $limit = (int) ((cfg('per_hour') ?: [])[$form] ?? 10);
    $fh = @fopen(data_dir() . '/rate-' . $form . '.json', 'c+');
    if (!$fh) return true;                                // can't keep count: don't block real people
    flock($fh, LOCK_EX);
    $all = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
    $now = time();
    foreach ($all as $k => $times) {                       // forget anything older than an hour
        $all[$k] = array_values(array_filter((array) $times, function ($t) use ($now) { return $now - (int) $t < 3600; }));
        if (!$all[$k]) unset($all[$k]);
    }
    $me = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|elia'), 0, 16);
    $ok = count($all[$me] ?? []) < $limit;
    if ($ok) $all[$me][] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, (string) json_encode($all));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    @chmod(data_dir() . '/rate-' . $form . '.json', 0600);
    return $ok;
}

/* ---- e-mail ------------------------------------------------------------------------------------------------------ */

function mime_header(string $s): string
{
    $s = trim(preg_replace('/[\r\n]+/', ' ', $s) ?? '');
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

/** The submission as "Label: value" lines, blank fields left out. */
function as_lines(array $d): string
{
    $out = [];
    foreach ($d as $k => $v) {
        if ($v === '' || $v === null) continue;
        $v = (string) $v;
        $out[] = strpos($v, "\n") !== false ? label((string) $k) . ":\n" . $v : label((string) $k) . ': ' . $v;
    }
    return implode("\n", $out);
}

/** Sends one plain-text e-mail, with files attached if given: [['path' => …, 'name' => …, 'type' => …], …]. */
function send_mail(string $to, string $subject, string $text, ?string $reply_to = null, array $files = []): bool
{
    if (!valid_email($to)) return false;
    $from = (string) cfg('mail_from');
    $eol = "\r\n";
    $headers = ['From: ' . mime_header((string) cfg('mail_from_name')) . ' <' . $from . '>', 'MIME-Version: 1.0', 'X-Mailer: ELIA website'];
    if ($reply_to && valid_email($reply_to)) $headers[] = 'Reply-To: ' . $reply_to;
    $plain = 'Content-Type: text/plain; charset=UTF-8' . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol
           . chunk_split(base64_encode($text), 76, $eol);
    $files = array_values(array_filter($files, function ($f) { return is_file($f['path']); }));
    if (!$files) {
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: base64';
        $body = chunk_split(base64_encode($text), 76, $eol);
    } else {
        $b = 'mix-' . bin2hex(random_bytes(8));
        $headers[] = 'Content-Type: multipart/mixed; boundary="' . $b . '"';
        $body = '--' . $b . $eol . $plain;
        foreach ($files as $f) {
            $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $f['name']) ?: 'file';
            $body .= '--' . $b . $eol
                   . 'Content-Type: ' . $f['type'] . '; name="' . $name . '"' . $eol
                   . 'Content-Transfer-Encoding: base64' . $eol
                   . 'Content-Disposition: attachment; filename="' . $name . '"' . $eol . $eol
                   . chunk_split(base64_encode((string) file_get_contents($f['path'])), 76, $eol);
        }
        $body .= '--' . $b . '--' . $eol;
    }
    $hdr = implode($eol, $headers);
    $ok = @mail($to, mime_header($subject), $body, $hdr, '-f' . $from);
    if (!$ok) $ok = @mail($to, mime_header($subject), $body, $hdr);   // some hosts refuse the -f option
    return (bool) $ok;
}

/** Keeps a submission and e-mails it; answers 201 if at least one of the two worked. */
function deliver(string $file, string $subject, array $d, ?string $reply_to = null, array $files = []): void
{
    $id = new_id();
    $row = ['id' => $id, 'received' => date('Y-m-d H:i:s')] + $d;
    $saved = csv_append($file, $row);
    $text = $subject . "\n\n" . as_lines($d) . "\n\nReceived " . $row['received'] . " (Addis Ababa time), reference " . $id . ".\n"
          . ($reply_to ? "Reply to this e-mail to answer them directly.\n" : '');
    $sent = send_mail((string) cfg('notify_to'), '[ELIA website] ' . $subject, $text, $reply_to, $files);
    if (!$saved && !$sent) {
        finish(500, ['error' => 'Something went wrong on our side. Please try again, or e-mail ' . cfg('contact_email') . '.']);
    }
    finish(201, ['ok' => true, 'id' => $id]);
}
