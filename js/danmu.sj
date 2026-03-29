var spider = {};
var last_vod_name = "";
var last_play_list = "";

// 弹幕 API 工具库
var danmuApi = {
    baseUrl: "http://100.100.1.2:9000/danmu", // 替换为实际API地址

    searchEpisodes: function(animeName) {
        try {
            var url = this.baseUrl + "/api/v2/search/episodes?anime=" + encodeURIComponent(animeName);
            var res = req(url, { method: "get" });
            return JSON.parse(res.content);
        } catch(e) {
            return {};
        }
    }
};

spider.init = function(ext) { this.apiUrl = ext; };

spider.home = function(filter) {
    var classes = [];
    var list = [];
    
    try {
        // 1. 获取原始分类数据
        var resClass = req(this.apiUrl, { method: 'get', timeout: 3000 });
        var dataClass = JSON.parse(resClass.content);
        
        // 2. 这里只需要简单返回所有分类，TVBox 会自动根据 JSON 里的 categories 进行过滤和排序
        if (dataClass.class) {
            for (var i = 0; i < dataClass.class.length; i++) {
                var item = dataClass.class[i];
                classes.push({
                    type_id: item.type_id.toString(),
                    type_name: item.type_name
                });
            }
        }
        
        // 3. 加载首页推荐
        var resList = req(this.apiUrl + "?ac=videolist&h=24", { method: 'get', timeout: 3000 });
        var dataList = JSON.parse(resList.content);
        list = dataList.list || [];
        
    } catch (e) {
        // 即使出错也返回空数组，防止界面卡死
    }

    return JSON.stringify({
        class: classes,
        list: list
    });
};

spider.category = function(tid, pg, filter, extend) {
    var url = this.apiUrl + "?ac=videolist&t=" + tid + "&pg=" + pg;
    var res = req(url, { method: 'get' });
    return res.content;
};

spider.detail = function(id) {
    try {
        var url = this.apiUrl + "?ac=detail&ids=" + id;
        var res = req(url, { method: 'get' });
        var data = JSON.parse(res.content);

        if (data.list && data.list.length > 0) {
            var vod = data.list[0];

            var froms = vod.vod_play_from.split('$$$');
            var urls = vod.vod_play_url.split('$$$');
            
            var filteredFroms = [];
            var filteredUrls = [];

            for (var i = 0; i < froms.length; i++) {
                var fromName = froms[i].toLowerCase();
                
                if (fromName.indexOf('m3u8') > -1) {
                    filteredFroms.push(froms[i]);
                    filteredUrls.push(urls[i]);
                }
            }

            if (filteredFroms.length > 0) {
                vod.vod_play_from = filteredFroms.join('$$$');
                vod.vod_play_url = filteredUrls.join('$$$');

                last_play_list = filteredUrls[0];
            } else {

                last_play_list = urls[0]; 
            }
            
            last_vod_name = vod.vod_name;
        }
        return JSON.stringify(data);
    } catch (e) {
        return "{}";
    }
};

spider.search = function(wd, quick) {
    var url = this.apiUrl + "?ac=videolist&wd=" + encodeURIComponent(wd);
    var res = req(url, { method: 'get' });
    return res.content;
};

// 播放函数：这是修复重点
spider.play = function(flag, id, flags) {
    var epName = "";
    if (last_play_list) {
        var list = last_play_list.replace(/#/g, "###").split("###");
        for (var i = 0; i < list.length; i++) {
            if (list[i].indexOf(id) > -1) {
                epName = list[i].split("$")[0].trim();
                break;
            }
        }
    }
    if (!epName) epName = flag;

    // 匹配集数数字
    var numMatch = epName.match(/\d+/);
    var epInt = numMatch ? parseInt(numMatch[0], 10) : 0;
    
    var cid = "";
    var searchKey = last_vod_name || flag;

    if (searchKey) {
        var searchRes = danmuApi.searchEpisodes(searchKey);
        if (searchRes && searchRes.animes) {
            for (var i = 0; i < searchRes.animes.length; i++) {
                var anime = searchRes.animes[i];
                var eps = anime.episodes || [];
                for (var j = 0; j < eps.length; j++) {
                    var epItem = eps[j];
                    var titleNumMatch = epItem.episodeTitle.match(/第(\d+)集/) || epItem.episodeTitle.match(/\d+/);
                    var titleNum = titleNumMatch ? parseInt(titleNumMatch[1] || titleNumMatch[0], 10) : (j + 1);
                    if (titleNum === epInt) {
                        cid = epItem.episodeId;
                        break;
                    }
                }
                if (cid) break;
            }
        }
    }

    // 核心修复：TVBox/FongMi 期望的播放返回格式
    var result = {
        parse: 0,
        url: id, // 这里的 id 必须是原始视频播放地址
        header: { "User-Agent": "Mozilla/5.0" }
    };

    if (cid) {
        // 直接构造地址，不使用 proxy
        var danmuUrl = danmuApi.baseUrl + "/api/v2/comment/" + cid + "?format=xml";
        result.danmaku = [{
            url: danmuUrl,
            name: "弹幕",
            type: "xml"
        }];
    }

    return JSON.stringify(result);
};

// 确保虽然不用 proxy，但函数名必须存在
spider.proxy = function(obj) { return [404, "text/plain", ""]; };

__JS_SPIDER__ = spider;
