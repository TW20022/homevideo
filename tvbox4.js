/**
 * 量子资源网去广告蜘蛛 - 全局兼容版 (tvbox4.js)
 * 特点：零依赖、双重入口、增强兼容性
 */

var host = 'https://cj.lziapi.com';

// --- 核心入口函数 ---

async function init(cfg) {
    // 初始化逻辑，takagen99 必须保留此空函数
}

async function home(filter) {
    try {
        var res = await request(host + '/api.php/provide/vod/at/json');
        var data = JSON.parse(res);
        var classes = [];
        if (data.class) {
            for (var i = 0; i < data.class.length; i++) {
                classes.push({
                    type_id: data.class[i].type_id,
                    type_name: data.class[i].type_name
                });
            }
        }
        return JSON.stringify({ class: classes });
    } catch (e) {
        return JSON.stringify({ class: [] });
    }
}

async function category(tid, pg, filter, extend) {
    try {
        var url = host + '/api.php/provide/vod/at/json?ac=detail&t=' + tid + '&pg=' + pg;
        var res = await request(url);
        var data = JSON.parse(res);
        return JSON.stringify({
            page: data.page,
            pagecount: data.pagecount,
            limit: data.limit,
            total: data.total,
            list: data.list || []
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function detail(id) {
    try {
        var url = host + '/api.php/provide/vod/at/json?ac=detail&ids=' + id;
        var res = await request(url);
        var data = JSON.parse(res);
        return JSON.stringify({
            list: data.list || []
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function search(wd, quick) {
    try {
        var url = host + '/api.php/provide/vod/at/json?ac=detail&wd=' + encodeURIComponent(wd);
        var res = await request(url);
        var data = JSON.parse(res);
        return JSON.stringify({
            list: data.list || []
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, flags) {
    try {
        // 1. 获取原始 M3U8
        var m3u8Content = await request(id, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        // 2. 执行广告过滤
        var filteredM3U8 = cleanM3U8(m3u8Content);
        
        // 3. 构建 Base64 数据链接
        var base64Data = b64Encode(filteredM3U8);
        var resultUrl = 'data:application/vnd.apple.mpegurl;base64,' + base64Data;

        return JSON.stringify({
            parse: 0,
            url: resultUrl,
            header: { 'User-Agent': 'Mozilla/5.0' }
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: id });
    }
}

// --- 辅助工具函数 ---

function cleanM3U8(m3u8Text) {
    if (!m3u8Text) return "";
    var lines = m3u8Text.split("\n");
    var clean = [];
    var buffer = [];

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("#EXTINF:") === 0) {
            var duration = parseFloat(line.split(":")[1].split(",")[0]);
            var nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : "";
            buffer.push({ info: line, ts: nextLine, dur: duration });
            i++; // 跳过已经存入 buffer 的 TS 地址行
        } else {
            if (buffer.length === 7) {
                var isAd = true;
                for (var j = 0; j < 6; j++) {
                    if (Math.abs(buffer[j].dur - 4.0) > 0.1) isAd = false;
                }
                if (Math.abs(buffer[6].dur - 2.0) > 0.1) isAd = false;
                
                if (isAd) {
                    buffer = []; // 抛弃广告
                    if (line.indexOf("#") === 0) clean.push(line);
                    continue;
                }
            }
            // 释放 buffer
            for (var k = 0; k < buffer.length; k++) {
                clean.push(buffer[k].info);
                clean.push(buffer[k].ts);
            }
            buffer = [];
            if (line) clean.push(line);
        }
    }
    return clean.join("\n");
}

function b64Encode(str) {
    // 兼容大部分 JS 引擎的 Base64 转换
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        return "";
    }
}

// --- 入口导出：双重保险 ---

var spider = {
    init: init,
    home: home,
    category: category,
    detail: detail,
    search: search,
    play: play
};

// 适配导出模式
export default spider;

// 适配全局变量模式
globalThis.spider = spider;
