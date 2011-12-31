<?php
/**
* Example JSON file storage (now with backups!)
*
* This PHP script is an extension to the previously idiotically simple.php script
* It expands on simple.php by providing a fairly safe(ish) backup system for previous .json files.
*
* This method, like simple.php, is not really ment to be used in a production environment but can at least be realiably used to test the system without anything major happening to cause data loss.
* Data restoration is left as an excersize for the SysAdmin. Be nice to him - he knows Linux.
*/

define('FLUX_DIR', '.'); // Directory to save our sessions to - must be writable (by default this saves to _this_ script directory)
define('FLUX_MAX_SAVES', 100); // Maximum number of versions to save in FLUX_DIR. 0 is infinate. The higher this number the more your file system will bog down. Only set this to something high (or god help us - 0) if you understand the implications.

if (isset($_POST['json'])) { // Wanting to store some data (i.e. SAVE)
	$now = time();
	if (! $json = json_decode($_POST['json'])) // Sanity check that it can be parsed
		die('Invalid JSON code');
	$json->age = $now; // Inject EPOC timestamp

	chdir(FLUX_DIR);
	$fh = fopen("$now.json", 'w'); // Open file for writing and dump the newly encoded JSON as a timestamped file
	fwrite($fh, json_encode($json));
	fclose($fh);

	if (FLUX_MAX_SAVES > 0) { // Clean up older archive versons
		$files = glob('*.json');
		foreach ($delete_file as array_slice($files, 0, count($files) - FLUX_MAX_SAVES)) { // Get list of delete candidates
			unlink($delete_file); // Buwhahaha
		}
	}
} else { // ... Not given anything to store - provide data back (i.e. LOAD)
	readfile(end(glob('*.json')));
);
}
