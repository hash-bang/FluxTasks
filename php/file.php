<?
/**
* Example JSON file storage
* This method is not really ment to be used as it REALLY doesn't scale very well
*/

define('FLUX_FILE', 'flux.json'); // File must be writable

if (isset($_POST['json'])) { // Wanting to store some data
	if (! $json = json_decode($_POST['json']))
		die('Invalid JSON code');
	$json->age = time(); // Insert EPOC timestamp

	$fh = fopen(FLUX_FILE, 'w');
	fwrite($fh, json_encode($json));
	fclose($fh);
} else { // Requesting data
	readfile(FLUX_FILE);
}
