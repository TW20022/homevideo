var rule = {
    title: '量子资源网去广告',
    host: 'https://cj.lziapi.com',
    homeUrl: '/api.php/provide/vod/at/json',
    url: '/api.php/provide/vod/at/json?ac=detail&id=fyid',
    searchUrl: '/api.php/provide/vod/at/json?wd=**&ac=detail',
    listUrl: '/api.php/provide/vod/at/json?ac=detail&t=fyclass&page=fypage',
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
    play_parse: true,
    lazy: async (flag, url, input, parse) => {
        // 拉取原始 m3u8
        let raw = await request(url);
        let clean = cleanM3U8(raw);
        // 返回干净 m3u8
        return {parse: 0, url: 'data:application/vnd.apple.mpegurl;base64,' + base64Encode(clean)};
    },
    parse: async (json) => {
        let list = [];
        let data = JSON.parse(json);
        if (data.list) {
            data.list.forEach(v => {
                list.push({
                    vod_id: v.vod_id,
                    vod_name: v.vod_name,
                    vod_pic: v.vod_pic || '',
                    vod_remarks: v.vod_remarks || ''
                });
            });
        }
        return list;
    },
    class_parse: async (json) => {
        let classes = [];
        let data = JSON.parse(json);
        if (data.class) {
            data.class.forEach(c => {
                classes.push({
                    type_id: c.type_id,
                    type_name: c.type_name
                });
            });
        }
        return classes;
    }
};

// 广告过滤函数
function cleanM3U8(m3u8Text) {
    const lines = m3u8Text.split("\n");
    let clean = [];
    let buffer = [];

    for (let line of lines) {
        if (line.startsWith("#EXTINF:")) {
            const duration = parseFloat(line.replace("#EXTINF:", "").replace(",", ""));
            buffer.push({line, duration});
        } else if (line.endsWith(".ts")) {
            buffer[buffer.length - 1].ts = line;
        } else {
            // 检查广告模式：连续 7 段 (6x4s + 1x2s)
            if (buffer.length === 7) {
                const durations = buffer.map(b => b.duration);
                const isAd = durations.slice(0,6).every(d => Math.abs(d-4.0)<0.01) &&
                             Math.abs(durations[6]-2.0)<0.01;
                if (isAd) {
                    buffer = []; // 丢弃广告
                    continue;
                }
            }
            // 写入非广告片段
            for (let b of buffer) {
                clean.push(b.line);
                clean.push(b.ts);
            }
            buffer = [];
            clean.push(line);
        }
    }
    return clean.join("\n");
}

// Base64 编码函数
function base64Encode(str) {
    return java.lang.String(str).getBytes("UTF-8").toString("base64");
}
