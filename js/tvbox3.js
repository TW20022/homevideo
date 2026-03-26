/**
 * 量子资源网
 * 适配：takagen99 / TVBoxOSC / FongMi
 */

let host = 'https://cj.lziapi.com';

/**
 * 核心：初始化
 */
async function init(cfg) {
    // 留空即可，确保接口协议完整
}

/**
 * 首页分类获取
 */
async function home(filter) {
    try {
        const res = await request(host + '/api.php/provide/vod/at/json');
        const data = JSON.parse(res);
        const classes = (data.class || []).map(c => ({
            type_id: c.type_id,
            type_name: c.type_name
        }));
        return JSON.stringify({ class: classes });
    } catch (e) {
        return JSON.stringify({ class: [] });
    }
}

/**
 * 分类页数据
 */
async function category(tid, pg, filter, extend) {
    try {
        const url = `${host}/api.php/provide/vod/at/json?ac=detail&t=${tid}&pg=${pg}`;
        const res = await request(url);
        const data = JSON.parse(res);
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

/**
 * 详情页数据
 */
async function detail(id) {
    try {
        const url = `${host}/api.php/provide/vod/at/json?ac=detail&ids=${id}`;
        const res = await request(url);
        const data = JSON.parse(res);
        return JSON.stringify({
            list: data.list || []
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

/**
 * 搜索功能
 */
async function search(wd, quick) {
    try {
        const url = `${host}/api.php/provide/vod/at/json?ac=detail&wd=${encodeURIComponent(wd)}`;
        const res = await request(url);
        const data = JSON.parse(res);
        return JSON.stringify({
            list: data.list || []
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

/**
 * 播放解析与去广告逻辑
 */
async function play(flag, id, flags) {
    try {
        // 1. 请求原始 M3U8 文本
        const m3u8Content = await request(id, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        // 2. 过滤广告切片
        const filtered = cleanM3U8(m3u8Content);
        
        // 3. 零依赖 Base64 方案：使用 btoa 处理
        // 注意：某些老旧引擎不支持直接 btoa，这里做了安全处理
        const base64Data = base64Safe(filtered);
        const resultUrl = 'data:application/vnd.apple.mpegurl;base64,' + base64Data;

        return JSON.stringify({
            parse: 0,
            url: resultUrl,
            header: { 'User-Agent': 'Mozilla/5.0' }
        });
    } catch (e) {
        // 容错：解析失败则返回原始链接
        return JSON.stringify({ parse: 0, url: id });
    }
}

/**
 * 广告过滤：针对 6个4秒 + 1个2秒 的量子广告特征
 */
function cleanM3U8(m3u8) {
    if (!m3u8) return "";
    const lines = m3u8.split("\n");
    let result = [];
    let segments = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith("#EXTINF:")) {
            // 提取时长数字
            let duration = parseFloat(line.split(":")[1].split(",")[0]);
            let tsLine = lines[i + 1] ? lines[i + 1].trim() : "";
            segments.push({ info: line, ts: tsLine, dur: duration });
            i++; // 跳过下一行 TS 链接
        } else {
            // 处理积压的切片，检查广告特征
            if (segments.length > 0) {
                if (segments.length === 7) {
                    const isAd = segments.slice(0, 6).every(s => Math.abs(s.dur - 4.0) < 0.1) &&
                                 Math.abs(segments[6].dur - 2.0) < 0.1;
                    if (isAd) {
                        segments = []; // 抛弃这 7 个切片
                        if (line.startsWith("#")) result.push(line);
                        continue;
                    }
                }
                // 不是广告，释放到结果集
                segments.forEach(s => {
                    result.push(s.info);
                    result.push(s.ts);
                });
                segments = [];
            }
            if (line) result.push(line);
        }
    }
    return result.join("\n");
}

/**
 * 零依赖 Base64 编码工具
 */
function base64Safe(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        // 极端情况下如果 btoa 不可用（极少数魔改引擎），返回原字符串（会导致播放失败但不会报解析错误）
        return "";
    }
}

/**
 * 导出接口供 TVBox 调用
 */
export default {
    init,
    home,
    category,
    detail,
    search,
    play
};
