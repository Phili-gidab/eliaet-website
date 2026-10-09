<?php
/* The contact page's form: name, e-mail, subject and message (as server/src/api.ts checks them). */
require __DIR__ . '/_lib.php';
begin('contact');

$d = [
    'name'    => field('name', 120),
    'email'   => strtolower(field('email', 160)),
    'subject' => field('subject', 200),
    'message' => text_field('message', 5000),
];
$err = [];
if ($d['name'] === '') $err['name'] = 'Required';
if (!valid_email($d['email'])) $err['email'] = 'Enter a valid e-mail address';
if ($d['subject'] === '') $err['subject'] = 'Required';
if ($d['message'] === '') $err['message'] = 'Required';
if ($err) finish(422, ['error' => 'Please check the highlighted fields.', 'fields' => $err]);

deliver('contact.csv', 'Website message · ' . $d['name'], $d, $d['email']);
