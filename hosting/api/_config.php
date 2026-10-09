<?php
/* Settings of the site's forms on PHP hosting (for now: elia.allafricanleatherfair.org, on the AALF account).
   Change an address here, then put the site online again (hosting/deploy-elia.sh).
   When the site moves to ELIA's own hosting, set mail_from to an address on that domain (no-reply@eliaet.com). */

$site_root = dirname(__DIR__);                      // the folder the site is served from

return [
    // every message, appointment request, sign-up and membership application is e-mailed here
    'notify_to'      => 'info@eliaet.com',

    // the sender of those e-mails: an address on the domain the site is served from (it need not be a real mailbox),
    // so that mail providers trust it. Replies go to the person who filled in the form.
    'mail_from'      => 'no-reply@allafricanleatherfair.org',
    'mail_from_name' => 'ELIA website',

    // the address shown to visitors when something goes wrong
    'contact_email'  => 'info@eliaet.com',

    // the spreadsheet files (contact.csv, appointments.csv, subscribers.csv, membership.csv) and the uploaded stamps
    // are kept OUTSIDE the web root, where nobody can download them: /home/<account>/elia-data/<site folder>/
    'data_dir'       => dirname($site_root) . '/elia-data/' . basename($site_root),

    // at most this many sends per hour from one connection, per form
    'per_hour'       => ['contact' => 8, 'appointment' => 8, 'subscribe' => 10, 'membership' => 6],
];
