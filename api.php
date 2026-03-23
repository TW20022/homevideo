<?php
// api.php - 私人影库后端 V1.0
error_reporting(0);

$config = [
    'cache_dir'    => '/tmp/vod_cache',
    'cache_time'   => 86400, // 缓存24小时
    'api_base_url' => 'https://www.这里写入API地址.com/api.php/provide/vod/',
    'ignore_class' => ['电影片', '连续剧', '综艺片', '伦理片']
];

// 目录权限自适应处理
if (!is_dir($config['cache_dir'])) @mkdir($config['cache_dir'], 0777, true);
if (!is_writable($config['cache_dir'])) {
    $config['cache_dir'] = dirname(__FILE__) . '/cache_data';
    if (!is_dir($config['cache_dir'])) @mkdir($config['cache_dir'], 0777, true);
}

header('Content-Type: application/json; charset=utf-8');

// 清理缓存接口
if (isset($_GET['ac']) && $_GET['ac'] == 'clear') {
    @array_map('unlink', glob($config['cache_dir'] . "/*.json"));
    echo json_encode(["code" => 1, "msg" => "Cache Cleared"]);
    exit;
}

$ac  = ($_GET['ac'] ?? 'list') == 'detail' ? 'detail' : 'list';
$pg  = intval($_GET['pg'] ?? 1);
$wd  = trim($_GET['wd'] ?? '');
$t   = intval($_GET['t'] ?? 0);
$ids = preg_replace('/[^0-9,]/', '', $_GET['ids'] ?? '');

// 缓存读取逻辑
$cache_key = md5($ac . $pg . $wd . $t . $ids);
$cache_file = $config['cache_dir'] . '/' . $cache_key . '.json';

if (file_exists($cache_file) && (time() - filemtime($cache_file) < $config['cache_time'])) {
    $content = file_get_contents($cache_file);
    if (!empty($content)) { echo $content; exit; }
}

// 构造 API URL
$api_url = $config['api_base_url'] . "?ac=$ac&pg=$pg" . ($wd ? "&wd=".urlencode($wd) : "") . ($t ? "&t=$t" : "") . ($ids ? "&ids=$ids" : "");

$ch = curl_init($api_url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_USERAGENT => "VOD-System-1.0"
]);

$output = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code == 200 && !empty($output)) {
    $data = json_decode($output, true);
    if ($data) {
        // 资源筛选脱壳：只保留 m3u8 线路
        if ($ac == 'detail' && isset($data['list'][0])) {
            $v = &$data['list'][0];
            $froms = explode('$$$', $v['vod_play_from']);
            $urls = explode('$$$', $v['vod_play_url']);
            $m3u8_index = -1;
            foreach($froms as $k => $val) {
                if (stripos($val, 'm3u8') !== false) { $m3u8_index = $k; break; }
            }
            if ($m3u8_index !== -1) {
                $v['vod_play_from'] = $froms[$m3u8_index];
                $v['vod_play_url'] = $urls[$m3u8_index];
            }
        }
        // 列表分类清洗
        if ($ac == 'list' && isset($data['class'])) {
            $data['class'] = array_values(array_filter($data['class'], function($c) use ($config) {
                return !in_array($c['type_name'], $config['ignore_class']);
            }));
        }
        $final_json = json_encode($data);
        @file_put_contents($cache_file, $final_json);
        echo $final_json;
    } else {
        echo json_encode(["code"=>0, "msg"=>"JSON Error"]);
    }
} else {
    echo json_encode(["code"=>0, "msg"=>"CURL Error:".$http_code]);
}
