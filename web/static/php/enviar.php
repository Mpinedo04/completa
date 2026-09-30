<?php
/*
 * Electricitat Samsó — envia per correu els formularis de contacte i de sol·licitud de servei.
 * Compatible amb PHP 7.0+. Sense dependències.
 *
 * - Amb JavaScript: el navegador envia amb fetch (Accept: application/json) i rep {"ok": true|false}.
 * - Sense JavaScript: redirigeix a gracies.html (o torna enrere amb ?error=1).
 */

// ---- configuració ----
$DESTI    = 'electricitat@electricitatsamso.com';
$REMITENT = 'web@electricitatsamso.com';   // ha de ser una adreça del mateix domini (SPF)
$ESPERA   = 30;                            // segons mínims entre enviaments de la mateixa IP

// ---- utilitats ----
$json = strpos(isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '', 'application/json') !== false;
$lang = (isset($_POST['idioma']) && $_POST['idioma'] === 'es') ? 'es' : 'ca';
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/' . ($lang === 'es' ? 'cas/' : '');

function respon($ok, $error = '') {
    global $json, $base;
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => $ok, 'error' => $error));
    } else {
        header('Location: ' . $base . ($ok ? 'gracies.html' : 'sollicitar-servei.html?error=1'), true, 303);
    }
    exit;
}

function camp($nom, $max, $multilinia = false) {
    $v = isset($_POST[$nom]) ? trim((string) $_POST[$nom]) : '';
    if (!$multilinia) $v = preg_replace('/[\r\n\t]+/', ' ', $v);  // evita injecció de capçaleres
    return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . $base, true, 303);
    exit;
}

// ---- antispam ----
if (camp('web', 200) !== '') respon(true);  // camp trampa ple = robot; fem veure que ha anat bé

$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0';
$marca = sys_get_temp_dir() . '/samso_form_' . md5($ip);
if (is_file($marca) && time() - filemtime($marca) < $ESPERA) respon(false, 'massa_rapid');

// ---- dades ----
$tipus    = camp('tipus', 20) === 'servei' ? 'servei' : 'contacte';
$nom      = camp('nom', 100);
$telefon  = camp('telefon', 30);
$email    = camp('email', 120);
$poblacio = camp('poblacio', 80);
$servei   = camp('servei', 80);
$data     = camp('data', 10);
$missatge = camp('missatge', 3000, true);
$rgpd     = camp('rgpd', 1);

if ($nom === '' || $telefon === '' || $missatge === '' || $rgpd !== '1') respon(false, 'falten_camps');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) respon(false, 'email');
if (!preg_match('/^[0-9 +().-]{6,30}$/', $telefon)) respon(false, 'telefon');
if ($data !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) $data = '';

// ---- correu ----
$titol = ($tipus === 'servei' ? 'Sol·licitud de servei' : 'Missatge de contacte') . ' – ' . $nom;
$cos  = ($tipus === 'servei' ? "SOL·LICITUD DE SERVEI" : "MISSATGE DE CONTACTE") . " (web, " . strtoupper($lang) . ")\n\n";
$cos .= "Nom: $nom\nTelèfon: $telefon\n";
if ($email !== '')    $cos .= "Email: $email\n";
if ($poblacio !== '') $cos .= "Població: $poblacio\n";
if ($servei !== '')   $cos .= "Servei: $servei\n";
if ($data !== '')     $cos .= "Dia preferit: " . implode('/', array_reverse(explode('-', $data))) . "\n";
$cos .= "\nMissatge:\n$missatge\n\n--\nEnviat des de electricitatsamso.com el " . date('d/m/Y H:i') . " (IP $ip). Acceptada la política de privacitat.\n";

$capcaleres = array(
    'From: =?UTF-8?B?' . base64_encode('Web Electricitat Samsó') . "?= <$REMITENT>",
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
);
if ($email !== '') $capcaleres[] = "Reply-To: $email";

$enviat = mail($DESTI, '=?UTF-8?B?' . base64_encode($titol) . '?=', $cos, implode("\r\n", $capcaleres), '-f' . $REMITENT);

if ($enviat) {
    @touch($marca);
    respon(true);
}
respon(false, 'mail');
