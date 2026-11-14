(function () {
    'use strict';

    console.log('%c[m3u8_filter_ad]', 'font-weight: bold; color: white; background-color: #70b566b0; padding: 2px; border-radius: 2px;', '通用 m3u8 广告过滤脚本已加载');

    // 辅助函数：判断是否为 m3u8 文件
    function is_m3u8_file(url) {
        return typeof url === 'string' && /\.m3u8($|\?)/.test(url);
    }

    // 辅助函数：提取 .ts 前面的数字序列号
    function extract_number_before_ts(str) {
        const match = str.match(/(\d+)\.ts/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return null;
    }

    // 核心过滤算法（复用原有的自动模式与规则）
    function filter_lines(lines) {
        let result = [];
        let ts_name_len = 0;
        let ts_name_len_extend = 1;
        let first_extinf_row = '';
        let the_extinf_judge_row_n = 0;
        let the_same_extinf_name_n = 0;
        let the_extinf_benchmark_n = 5;
        let prev_ts_name_index = -1;
        let first_ts_name_index = -1;
        let ts_type = 0; 
        let the_ext_x_mode = 0;
        let violent_filter_mode_flag = false; // 默认自动判断模式

        let the_normal_int_ts_n = 0;
        let the_diff_int_ts_n = 0;
        let last_ts_name_len = 0;

        // 初始化参数与模式识别
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (the_extinf_judge_row_n === 0 && line.startsWith('#EXTINF')) {
                first_extinf_row = line;
                the_extinf_judge_row_n++;
            } else if (the_extinf_judge_row_n === 1 && line.startsWith('#EXTINF')) {
                if (line !== first_extinf_row) first_extinf_row = '';
                the_extinf_judge_row_n++;
            }

            let the_ts_name_len = line.indexOf('.ts');
            if (the_ts_name_len > 0) {
                if (the_extinf_judge_row_n === 1) ts_name_len = the_ts_name_len;
                last_ts_name_len = the_ts_name_len;

                let ts_name_index = extract_number_before_ts(line);
                if (ts_name_index === null) {
                    if (the_extinf_judge_row_n === 1) {
                        ts_type = 1;
                    } else if (the_extinf_judge_row_n === 2 && (ts_type === 1 || the_ts_name_len === ts_name_len)) {
                        ts_type = 1;
                        break;
                    } else {
                        the_diff_int_ts_n++;
                    }
                } else {
                    if (the_normal_int_ts_n === 0) {
                        first_ts_name_index = ts_name_index;
                        prev_ts_name_index = first_ts_name_index - 1;
                    }

                    if (the_ts_name_len !== ts_name_len) {
                        if (the_ts_name_len === last_ts_name_len + 1 && ts_name_index === prev_ts_name_index + 1) {
                            if (the_diff_int_ts_n) {
                                if (ts_name_index === prev_ts_name_index + 1) {
                                    ts_type = 0;
                                    prev_ts_name_index = first_ts_name_index - 1;
                                    break;
                                } else {
                                    ts_type = 2;
                                    break;
                                }
                            }
                            the_normal_int_ts_n++;
                            prev_ts_name_index = ts_name_index;
                        } else {
                            the_diff_int_ts_n++;
                        }
                    } else {
                        if (the_diff_int_ts_n) {
                            if (ts_name_index === prev_ts_name_index + 1) {
                                ts_type = 0;
                                prev_ts_name_index = first_ts_name_index - 1;
                                break;
                            } else {
                                ts_type = 2;
                                break;
                            }
                        }
                        the_normal_int_ts_n++;
                        prev_ts_name_index = ts_name_index;
                    }
                }
            }

            if (i === lines.length - 1) {
                ts_type = 2; // 降级为暴力拆解模式
            }
        }

        // 遍历并过滤行
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (ts_type === 0) {
                if (line.startsWith('#EXT-X-DISCONTINUITY') && lines[i + 1] && lines[i + 2]) {
                    if (i > 0 && lines[i - 1].startsWith('#EXT-X-')) {
                        result.push(line);
                        continue;
                    } else {
                        let the_ts_name_len = lines[i + 2].indexOf('.ts');
                        if (the_ts_name_len > 0) {
                            if (the_ts_name_len - ts_name_len > ts_name_len_extend) {
                                if (lines[i + 3] && lines[i + 3].startsWith('#EXT-X-DISCONTINUITY')) {
                                    i += 3;
                                } else {
                                    i += 2;
                                }
                                continue;
                            } else {
                                ts_name_len = the_ts_name_len;
                            }

                            let the_ts_name_index = extract_number_before_ts(lines[i + 2]);
                            if (the_ts_name_index !== prev_ts_name_index + 1) {
                                if (lines[i + 3] && lines[i + 3].startsWith('#EXT-X-DISCONTINUITY')) {
                                    i += 3;
                                } else {
                                    i += 2;
                                }
                                continue;
                            }
                        }
                    }
                }

                if (line.startsWith('#EXTINF') && lines[i + 1]) {
                    let the_ts_name_len = lines[i + 1].indexOf('.ts');
                    if (the_ts_name_len > 0) {
                        if (the_ts_name_len - ts_name_len > ts_name_len_extend) {
                            if (lines[i + 2] && lines[i + 2].startsWith('#EXT-X-DISCONTINUITY')) {
                                i += 2;
                            } else {
                                i += 1;
                            }
                            continue;
                        } else {
                            ts_name_len = the_ts_name_len;
                        }

                        let the_ts_name_index = extract_number_before_ts(lines[i + 1]);
                        if (the_ts_name_index === prev_ts_name_index + 1) {
                            prev_ts_name_index++;
                        } else {
                            if (lines[i + 2] && lines[i + 2].startsWith('#EXT-X-DISCONTINUITY')) {
                                i += 2;
                            } else {
                      
