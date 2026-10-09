<?php
/* "Make an appointment to discuss a project" (home and Services pages): name, e-mail, mobile, sector, date, and an
   optional note (as server/src/api.ts checks them). */
require __DIR__ . '/_lib.php';
begin('appointment');

const SECTORS = ['Tannery', 'Shoe manufacturing', 'Leather products'];

$d = [
    'name'    => field('name', 120),
    'email'   => strtolower(field('email', 160)),
    'mobile'  => field('mobile', 40),
    'sector'  => field('sector', 40),
    'date'    => field('date', 10),
    'message' => text_field('message', 5000),
];
$err = [];
if ($d['name'] === '') $err['name'] = 'Required';
if (!valid_email($d['email'])) $err['email'] = 'Enter a valid e-mail address';
if ($d['mobile'] === '') $err['mobile'] = 'Required';
if (!in_array($d['sector'], SECTORS, true)) $err['sector'] = 'Choose one';
$day = DateTime::createFromFormat('!Y-m-d', $d['date']);
if (!$day || $day->format('Y-m-d') !== $d['date']) $err['date'] = 'Pick a date';
if ($err) finish(422, ['error' => 'Please check the highlighted fields.', 'fields' => $err]);

deliver('appointments.csv', 'Appointment request · ' . $d['name'] . ' · ' . $d['date'], $d, $d['email']);
