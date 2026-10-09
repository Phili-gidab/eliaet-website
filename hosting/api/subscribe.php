<?php
/* The newsletter sign-up in every page's footer: an e-mail address. */
require __DIR__ . '/_lib.php';
begin('subscribe');

$d = ['email' => strtolower(field('email', 160))];
if (!valid_email($d['email'])) finish(422, ['error' => 'Please check the highlighted fields.', 'fields' => ['email' => 'Enter a valid e-mail address']]);

deliver('subscribers.csv', 'Newsletter sign-up · ' . $d['email'], $d, $d['email']);
