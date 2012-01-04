<?php
/**
* Example JSON file storage
*
* This PHP script is intended to show the lowest common denominator for saving a FluxTask JSON file
* All it really does is blindly (and very insecurely) accept a JSON post from a FluxTask instance and save the result in a writable file.
*
* This method is not really ment to be used as it REALLY doesn't scale very well - It is intended only for demonstration processes
*
* REPEAT: Do *NOT* use this file in a production system.
*/

define('FLUX_FILE', 'storage/flux.json'); // File to save our session to - must be writable

if (isset($_POST['json'])) { // Wanting to store some data (i.e. SAVE)
	if (! $json = json_decode($_POST['json'])) // Sanity check that it can be parsed
		die('Invalid JSON code');
	$json->age = time(); // Inject EPOC timestamp

	$fh = fopen(FLUX_FILE, 'w'); // Open file for writing and dump the newly encoded JSON
	fwrite($fh, json_encode($json));
	fclose($fh);
} else { // ... Not given anything to store - provide data back (i.e. LOAD)
	readfile(FLUX_FILE);
}

// ... and thats all there really is to it
