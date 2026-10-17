/* Softbox test plugin, 0.7.0. Public metadata; verified SOFTBOX; minimum 1080p. */
(function () {
    'use strict';
    function unescapeHtml(value) {
        return value.replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
    function episodes(text, source) {
        source = source || 'ok';
        var allowed = {
            ok: /^https:\/\/ok\.ru\/videoembed\/\d+(?:\?.*)?$/,
            vk: /^https:\/\/(?:vk\.com|vkvideo\.ru)\/video_ext\.php\?[^\s]+$/,
            mail: /^https:\/\/my\.mail\.ru\/video\/embed\/\d+$/
        };
        var result = [], seen = {}, match;
        var pattern = /<li\b([^>]*\bdata-file\s*=\s*(["'])(.*?)\2[^>]*)>([\s\S]*?)<\/li>/gi;
        while ((match = pattern.exec(text))) {
            var url = unescapeHtml(unescapeHtml(match[3]));
            if (url.indexOf('//') === 0) url = 'https:' + url;
            if (!allowed[source] || !allowed[source].test(url) || seen[url]) continue;
            var title = unescapeHtml(match[4].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
            seen[url] = true;
            result.push({title: title, url: url});
        }
        return result;
    }
    function streams(text) {
        var match, pattern = /data-options\s*=\s*(["'])([\s\S]*?)\1/gi;
        var names = {mobile: '144p', lowest: '240p', low: '360p', sd: '480p', hd: '720p', full: '1080p', quad: '1440p', ultra: '2160p'};
        if (/Access to this video is restricted/.test(text)) throw new Error('Доступ к видео ограничен');
        while ((match = pattern.exec(text))) {
            try {
                var options = JSON.parse(unescapeHtml(match[2]));
                var metadata = options.flashvars && options.flashvars.metadata;
                if (typeof metadata === 'string') metadata = JSON.parse(metadata);
                if (!metadata || !metadata.videos) continue;
                var quality = {}, url = '';
                metadata.videos.forEach(function (item) {
                    if (/^https:\/\/[^/]+\/(?:[^\s]*)$/.test(item.url) && /^(?:[a-z0-9-]+\.)*(?:okcdn\.ru|mycdn\.me)$/i.test(item.url.split('/')[2])) {
                        quality[names[item.name] || item.name] = item.url;
                        url = item.url;
                    }
                });
                if (url) return {url: url, quality: quality, title: metadata.movie.title};
            } catch (error) { /* Try another data-options block, never evaluate site code. */ }
        }
        throw new Error('OK.ru не выдал доступный видеопоток');
    }
    function vkStreams(text) {
        var notice = unescapeHtml(text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' '));
        if (/jugendgef|adult content|возрастн|18\+/i.test(notice)) throw new Error('VK: ограничение 18+, встраивание запрещено');
        if (/Urheberrechtsbeschwerde|copyright|правообладател/i.test(notice)) throw new Error('VK: видео удалено по жалобе правообладателя');
        if (/Autor hat den Zugriff|author.*restricted|Автор.*огранич|доступ.*огранич/i.test(notice)) throw new Error('VK: Автор ограничил доступ к видео');
        var match = /var\s+playerParams\s*=\s*({[\s\S]+?})\s*;/.exec(text);
        if (match) {
            var data = JSON.parse(match[1]), params = data.params && data.params[0];
            var quality = {}, url = '', best = 0;
            Object.keys(params || {}).forEach(function (key) {
                var height = /^url(\d+)$/.exec(key), value = params[key];
                if (height && typeof value === 'string') {
                    if (value.indexOf('//') === 0) value = 'https:' + value;
                    if (!/^https:\/\/[^/\s]+\/[^\s]*$/.test(value)) return;
                    quality[height[1] + 'p'] = value;
                    if (+height[1] > best) { best = +height[1]; url = value; }
                }
            });
            if (url) return {url: url, quality: quality, title: params.md_title || 'VK'};
        }
        var prefetch = /(?:"apiPrefetchCache"\s*:|(?:window\.)?cur\.apiPrefetchCache\s*=)\s*\[/.exec(text);
        if (prefetch) {
            var start = prefetch.index + prefetch[0].length - 1, depth = 0, quoted = false, escaped = false, end;
            for (end = start; end < text.length; end++) {
                var ch = text.charAt(end);
                if (quoted) {
                    if (escaped) escaped = false;
                    else if (ch === '\\') escaped = true;
                    else if (ch === '"') quoted = false;
                } else if (ch === '"') quoted = true;
                else if (ch === '[') depth++;
                else if (ch === ']' && --depth === 0) break;
            }
            var cache = JSON.parse(text.slice(start, end + 1)), item;
            cache.some(function (entry) {
                if (entry.method === 'video.get' && entry.response && entry.response.items) {
                    item = entry.response.items[0];
                    return !!item;
                }
                return false;
            });
            var modernQuality = {}, modernUrl = '', modernBest = 0;
            Object.keys(item && item.files || {}).forEach(function (key) {
                var height = /^mp4_(\d+)$/.exec(key), value = item.files[key];
                if (height && typeof value === 'string' && /^https:\/\/[^/\s]+\/[^\s]*$/.test(value)) {
                    modernQuality[height[1] + 'p'] = value;
                    if (+height[1] > modernBest) { modernBest = +height[1]; modernUrl = value; }
                }
            });
            if (modernUrl) return {url: modernUrl, quality: modernQuality, title: unescapeHtml(item.title || 'VK')};
        }
        throw new Error('VK не выдал публичный видеопоток: видео недоступно или требуется вход');
    }
    function mailStreams(text) {
        var metadata = typeof text === 'string' ? JSON.parse(text.replace(/^\uFEFF/, '')) : text;
        var quality = {}, url = '', best = 0;
        (metadata.videos || []).forEach(function (item) {
            var value = item.url, height = parseInt(item.key, 10);
            if (typeof value !== 'string' || !height) return;
            if (value.indexOf('//') === 0) value = 'https:' + value;
            if (!/^https:\/\/(?:[a-z0-9-]+\.)*my\.mail\.ru\/[^\s]*$/i.test(value)) return;
            quality[item.key] = value;
            if (height > best) { best = height; url = value; }
        });
        if (!url) throw new Error('Mail.ru не выдал доступный видеопоток');
        return {url: url, quality: quality, title: metadata.meta && metadata.meta.title || 'Видео Mail.ru'};
    }
    function fanEpisodes(text, expectedId) {
        var data = text;
        if (typeof text === 'string') {
            var match = /window\.playerData\s*=\s*(\{[\s\S]*?\});/.exec(text);
            if (!match) throw new Error('FanSerials: список серий недоступен');
            data = JSON.parse(match[1]);
        }
        var playlist = data && data.playlist, info = playlist && playlist.current;
        if (!info || String(info.id) !== String(expectedId)) throw new Error('FanSerials: другая дорама');
        var result = [], seen = {}, season = +(info.startSeason || 1);
        (playlist.serial && playlist.serial.list || []).forEach(function (items, index) {
            (items || []).forEach(function (episode, position) {
                (episode.voices || []).some(function (voice) {
                    var name = data.voices && data.voices[voice.voice_id];
                    if (typeof name !== 'string' || !/^soft\s*box$/i.test(name.trim()) || !/^\d+$/.test(String(voice.video_id))) return false;
                    var number = episode.num != null ? episode.num : position + 1;
                    var key = (season + index) + ':' + number + ':' + (episode.spec_ep || 0);
                    if (!seen[key]) {
                        seen[key] = true;
                        result.push({title: (season + index) + ' сезон · ' + number + (episode.spec_ep ? ' спецсерия' : ' серия'), video_id: String(voice.video_id), voice: 'SOFTBOX'});
                    }
                    return true;
                });
            });
        });
        if (!result.length) throw new Error('FanSerials: озвучка SOFTBOX не найдена');
        return result;
    }
    function strict1080(data) {
        var quality = {}, best = 0, url = '';
        Object.keys(data.quality || {}).forEach(function (key) {
            var match = /^(\d+)p$/.exec(key), value = data.quality[key];
            if (match && +match[1] >= 1080 && typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value)) {
                quality[key] = value;
                if (+match[1] > best) { best = +match[1]; url = value; }
            }
        });
        if (!url) throw new Error('SOFTBOX: поток 1080p или выше не найден');
        return {url: url, quality: quality, title: data.title};
    }
    function fanLink(value, base) {
        if (typeof value !== 'string' || /\s/.test(value)) throw new Error('FanSerials: неверная ссылка');
        if (value.indexOf('//') === 0) value = 'https:' + value;
        else if (value.indexOf('/') === 0) value = base.match(/^https:\/\/[^/]+/)[0] + value;
        else if (value.indexOf('://') === -1) value = base.split('?')[0].replace(/[^/]*$/, '') + value;
        if (!/^https:\/\/(?:(?:s|cdn|a)\d+\.)?(?:lomont\.site|flintraxvk-companet\.pro)\/[^\s]*$/i.test(value)) throw new Error('FanSerials: неверный домен потока');
        return value;
    }
    function fanStreams(text, base) {
        if (!/^\uFEFF?#EXTM3U/.test(text)) throw new Error('FanSerials: HLS-плейлист недоступен');
        var lines = text.split(/\r?\n/), quality = {}, height = 0;
        lines.forEach(function (line) {
            line = line.trim();
            if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
                var match = /(?:^|[, :])RESOLUTION=(\d+)x(\d+)(?:,|$)/i.exec(line);
                height = match && +match[2] >= 1080 ? +match[2] : 0;
            } else if (line && line.charAt(0) !== '#') {
                if (height) {
                    try { quality[height + 'p'] = fanLink(line, base); } catch (error) { /* Ignore non-provider streams. */ }
                }
                height = 0;
            }
        });
        return strict1080({quality: quality, title: 'SOFTBOX'});
    }
    function siteEpisodes(data) {
        if (typeof data === 'string') data = JSON.parse(data.replace(/^\uFEFF/, ''));
        if (!data || !data.success || typeof data.response !== 'string') throw new Error('На сайте нет списка серий OK.ru/VK/Mail.ru; возможен другой источник (Vibix)');
        var items = [], labels = {ok: 'OK.ru', vk: 'VK', mail: 'Mail.ru'};
        ['ok', 'vk', 'mail'].forEach(function (provider) {
            episodes(data.response, provider).forEach(function (item) {
                item.title += ' · ' + labels[provider];
                item.source = provider;
                item.voice = 'SOFTBOX';
                items.push(item);
            });
        });
        if (!items.length) throw new Error('На сайте нет серий для поддерживаемых источников OK.ru/VK/Mail.ru');
        return items;
    }
    function siteCatalogue(text, page) {
        if (typeof text !== 'string') throw new Error('Softbox: каталог сайта недоступен');
        var items = [], seen = {}, match, pages = page;
        var articles = /<article\b[^>]*\bclass=["'][^"']*\bmoviebox\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
        while ((match = articles.exec(text))) {
            var link = /<a\b[^>]*\bhref=["']((?:https:\/\/softboxdorama\.com)?\/(\d+)-[^"'\s<>]+\.html)["']/i.exec(match[1]);
            var title = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(match[1]);
            if (!link || !title || seen[link[2]]) continue;
            var name = unescapeHtml(title[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
            if (!name) continue;
            seen[link[2]] = true;
            var image = /<img\b[^>]*\bdata-src=["']([^"']+)["']/i.exec(match[1]) || /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(match[1]);
            var poster = image ? unescapeHtml(image[1]) : '';
            if (poster.charAt(0) === '/' && poster.charAt(1) !== '/') poster = 'https://softboxdorama.com' + poster;
            if (!/^https:\/\/softboxdorama\.com\/uploads\/[^\s<>"']+$/i.test(poster)) poster = '';
            var genre = /<span\b[^>]*class=["'][^"']*\bgenre\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(match[1]);
            var description = genre ? unescapeHtml(genre[1].replace(/<[^>]+>/g, '')).trim() : '';
            var year = /\b(19\d{2}|20\d{2})\b/.exec(description);
            items.push({id: +link[2], name: name, title: name, source: 'site', poster: poster,
                first_air_date: year ? year[1] + '-01-01' : '', overview: description});
        }
        if (!items.length) throw new Error('Softbox: каталог сайта пуст или формат изменился');
        var navigation = /<span\b[^>]*class=["']navigation["'][^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*class=["']pnext["']/i.exec(text);
        if (navigation) {
            var links = /(?:https:\/\/softboxdorama\.com)?\/(?:doramy|ongoing)\/page\/(\d+)\//g;
            while ((match = links.exec(navigation[1]))) pages = Math.max(pages, +match[1]);
        }
        return {items: items, pages: pages, next: page < pages ? page + 1 : 0};
    }
    var catalogue = [
        {"id": 1267353, "name": "Аварийная посадка любви", "seasons": [[624609, 624617, 624618, 631794, 631795, 631796, 631797, 631798, 631799, 624610, 624611, 624612, 624613, 624614, 624615, 624616]]},
        {"id": 4522058, "name": "Деловое предложение", "seasons": [[623391, 623392, 623393, 623394, 623395, 623396, 623397, 623398, 623399, 623400, 623401, 623402]]},
        {"id": 1398965, "name": "Истинная красота", "seasons": [[663458, 663459, 663460, 663461, 663462, 663463, 663464, 663465, 663466, 663467, 663468, 663469, 663470, 663471, 663472, 663473]]},
        {"id": 4872515, "name": "Алхимия душ", "seasons": [[624067, 624068, 624069, 624070, 624071, 624072, 624073, 624074, 624075, 624076, 624077, 624078, 624079, 624080, 624081, 624082, 624083, 624084, 624085, 624086], [624027, 624028, 624029, 624030, 624031, 624032, 624033, 624034, 624035, 624036]]},
        {"id": 5229364, "name": "Королева слёз", "seasons": [[865371, 842449, 842450, 842451, 842452, 842453, 842454, 842455, 842456, 842457, 842458, 842459, 842460, 842461, 842462, 842463]]}
    ].map(function (item) {
        item.source = 'fan';
        item.fallback = [];
        item.seasons.forEach(function (ids, season) {
            ids.forEach(function (id, episode) {
                item.fallback.push({title: (season + 1) + ' сезон · ' + (episode + 1) + ' серия', video_id: String(id), voice: 'SOFTBOX'});
            });
        });
        item.title = item.name + ' · ' + item.fallback.length + ' серий';
        return item;
    });
    var api = {episodes: episodes, streams: streams, vkStreams: vkStreams, mailStreams: mailStreams, fanEpisodes: fanEpisodes, fanStreams: fanStreams, strict1080: strict1080, catalogue: catalogue, siteCatalogue: siteCatalogue, siteEpisodes: siteEpisodes};
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
    if (typeof Lampa === 'undefined' || window.softbox_test_ready) return;
    window.softbox_test_ready = true;
    var sources = [
        {title: 'OK.ru — Алхимия душ', source: 'ok', id: 715, name: 'Алхимия душ'},
        {title: 'VK — официальный SOFTBOX', source: 'vk', name: 'SOFTBOX', items: [
            {title: 'Этот парень — чёрный огненный дракон · 01 серия', url: 'https://vk.com/video_ext.php?oid=-79421595&id=456248310&hash=3561e403e348bca4&hd=2'},
            {title: 'Этот парень — чёрный огненный дракон · 02 серия', url: 'https://vk.com/video_ext.php?oid=-79421595&id=456248311&hash=22e769385539ed76&hd=2'},
            {title: 'Аварийная посадка любви · 01 серия', url: 'https://vk.com/video_ext.php?oid=-79421595&id=456246686&hash=62706a9be228f3b7&hd=2'}
        ]},
        {title: 'Видео Mail.ru — Винченцо (нужен 1080p)', source: 'mail', id: 554, name: 'Винченцо'},
        {title: 'Проверенные источники · 5 дорам', source: 'verified'},
        {title: 'Все дорамы сайта · живой каталог', source: 'catalogue'}
    ];
    var network = new Lampa.Reguest(), busy = false, current = sources[0];
    function fail(error) {
        busy = false;
        Lampa.Noty.show('Softbox: ' + (error && (error.message || error.decode_error || (error.status === 404 && 'Видео удалено или недоступно (404)')) || 'Ошибка загрузки'));
        Lampa.Controller.toggle(current && current.softbox_cards ? 'content' : 'menu');
    }
    var fanOptions = {dataType: 'text', timeout: 20000, headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        'Origin': 'https://chudottvorcu-lordfilm.ru', 'Referer': 'https://chudottvorcu-lordfilm.ru/'
    }};
    function finish(data, episode, source) {
        data = strict1080(data);
        data.title = source.name + ' — ' + episode.title + ' · SOFTBOX';
        Lampa.Storage.set('softbox_test_episode_' + source.source + (source.source === 'fan' || source.site ? '_' + source.id : ''), episode.title);
        busy = false;
        Lampa.Player.play(data);
    }
    function play(episode) {
        if (busy) return;
        var source = current;
        if (source.source === 'site') source = {source: episode.source, id: source.id, name: source.name, site: true};
        busy = true;
        Lampa.Noty.show('Softbox: получаю видеопоток 1080p…');
        if (source.source === 'fan') {
            if (episode.voice !== 'SOFTBOX' || !/^\d+$/.test(episode.video_id)) return fail(new Error('Озвучка SOFTBOX не подтверждена'));
            network.native('https://lomont.site/videos.php?id=' + episode.video_id, function (text) {
                try {
                    var json = typeof text === 'string' ? JSON.parse(text.replace(/^\uFEFF/, '')) : text;
                    var url = fanLink(json.video, 'https://lomont.site/');
                    if (url.indexOf('/' + episode.video_id + '/') === -1) throw new Error('FanSerials: другая серия');
                    network.native(url, function (manifest) {
                        try { finish(fanStreams(manifest, url), episode, source); } catch (error) { fail(error); }
                    }, fail, false, fanOptions);
                } catch (error) { fail(error); }
            }, fail, false, fanOptions);
            return;
        }
        var requestUrl = episode.url;
        if (source.source === 'mail') requestUrl = 'https://my.mail.ru/+/video/meta/' + episode.url.split('/').pop();
        network.native(requestUrl, function (text) {
            try {
                var data = source.source === 'vk' ? vkStreams(text) : source.source === 'mail' ? mailStreams(text) : streams(text);
                finish(data, episode, source);
            } catch (error) { fail(error); }
        }, fail, false, {dataType: 'text', timeout: 20000});
    }
    var sitePage = 1;
    function openSiteCatalogue(page) {
        if (busy) return;
        page = typeof page === 'number' && page >= 1 && page % 1 === 0 ? page : 1;
        busy = true;
        var url = 'https://softboxdorama.com/doramy/' + (page > 1 ? 'page/' + page + '/' : '');
        network.native(url, function (text) {
            try {
                var result = siteCatalogue(text, page), items = result.items;
                sitePage = page;
                if (page > 1) items.push({title: '← Предыдущая страница', page: page - 1});
                if (result.next) items.push({title: 'Следующая страница →', page: result.next});
                if (page > 2) items.push({title: 'К началу каталога', page: 1});
                if (result.pages > page + 1) items.push({title: 'Последняя страница (' + result.pages + ')', page: result.pages});
                busy = false;
                Lampa.Select.show({title: 'Все дорамы SOFTBOX · ' + page + ' / ' + result.pages,
                    items: items, onSelect: function (item) { if (item.page) openSiteCatalogue(item.page); else openSeries(item); }, onBack: open});
            } catch (error) { fail(error); }
        }, fail, false, {dataType: 'text', timeout: 20000});
    }
    function openCatalogue() {
        if (busy) return;
        Lampa.Select.show({title: 'SOFTBOX · 1080p+ · ' + catalogue.length + ' дорам', items: catalogue, onSelect: openSeries, onBack: open});
    }
    function openSeries(source) {
        if (busy) return;
        if (source.source === 'catalogue') return openSiteCatalogue();
        if (source.source === 'verified') return openCatalogue();
        current = source;
        if (source.source === 'site') {
            if (!/^\d+$/.test(String(source.id))) return fail(new Error('Неверная дорама'));
            busy = true;
            network.native('https://softboxdorama.com/engine/ajax/playlists.php?news_id=' + source.id + '&xfield=playlist', function (text) {
                try {
                    var items = siteEpisodes(text);
                    items.forEach(function (item) { item.selected = item.title === Lampa.Storage.get('softbox_test_episode_' + item.source + '_' + source.id, ''); });
                    busy = false;
                    Lampa.Select.show({title: source.name + ' · SOFTBOX · минимум 1080p', items: items,
                        onSelect: play, onBack: function () { if (source.softbox_cards) Lampa.Controller.toggle('content'); else openSiteCatalogue(sitePage); }});
                } catch (error) { fail(error); }
            }, fail, false, {dataType: 'text', timeout: 20000});
            return;
        }
        if (source.source === 'fan') {
            busy = true;
            function showFan(items) {
                var last = Lampa.Storage.get('softbox_test_episode_fan_' + source.id, '');
                items.forEach(function (item) { item.selected = item.title === last; });
                busy = false;
                Lampa.Select.show({title: source.name + ' · SOFTBOX · 1080p+', items: items, onSelect: play, onBack: openCatalogue});
            }
            function savedFan() {
                Lampa.Noty.show('Softbox: использую проверенный список SOFTBOX; ссылки будут свежими');
                showFan(source.fallback.map(function (item) { return {title: item.title, video_id: item.video_id, voice: item.voice}; }));
            }
            network.native('https://lomont.site/met/' + source.id, function (text) {
                try {
                    if (typeof text === 'string' && !/window\.playerData\s*=/.test(text)) savedFan();
                    else showFan(fanEpisodes(text, source.id));
                } catch (error) { fail(error); }
            }, savedFan, false, fanOptions);
            return;
        }
        if (source.items) {
            Lampa.Select.show({title: source.title, items: source.items, onSelect: play, onBack: open});
            return;
        }
        busy = true;
        Lampa.Noty.show('Softbox: загружаю серии…');
        network.native('https://softboxdorama.com/engine/ajax/playlists.php?news_id=' + source.id + '&xfield=playlist', function (text) {
            try {
                var json = typeof text === 'string' ? JSON.parse(text.replace(/^\uFEFF/, '')) : text;
                if (!json.success) throw new Error('Список серий недоступен');
                var items = episodes(json.response, source.source);
                if (!items.length) throw new Error('Нет серий для выбранного источника');
                var last = Lampa.Storage.get('softbox_test_episode_' + source.source, '');
                items.forEach(function (item) { item.selected = item.title === last; });
                busy = false;
                Lampa.Select.show({title: source.name + ' · ' + source.source.toUpperCase(), items: items, onSelect: play, onBack: open});
            } catch (error) { fail(error); }
        }, fail, false, {dataType: 'text', timeout: 20000});
    }
    function open() {
        if (busy) return;
        Lampa.Select.show({title: 'Softbox тест · 0.7.0', items: sources, onSelect: openSeries, onBack: function () { Lampa.Controller.toggle('menu'); }});
    }
    // The same native row/grid components as dorama.js; retain the site and playback adapters.
    var cardsReady = !!(Lampa.Component && Lampa.InteractionMain && Lampa.InteractionCategory);
    var cardCache = {}, cardSections = [
        {title: 'Все дорамы SOFTBOX', section: 'doramy'},
        {title: 'Сейчас выходят', section: 'ongoing'}
    ];
    function clone(data) { return JSON.parse(JSON.stringify(data)); }
    function loadCards(request, section, page, resolve, reject) {
        section = section === 'ongoing' ? 'ongoing' : 'doramy';
        var key = section + ':' + page, now = Date.now();
        Object.keys(cardCache).forEach(function (name) { if (now - cardCache[name].time >= 600000) delete cardCache[name]; });
        if (cardCache[key]) return resolve(clone(cardCache[key].data));
        var url = 'https://softboxdorama.com/' + section + '/' + (page > 1 ? 'page/' + page + '/' : '');
        request.native(url, function (text) {
            try {
                var parsed = siteCatalogue(text, page);
                var data = {results: parsed.items, page: page, total_pages: parsed.pages};
                var keys = Object.keys(cardCache);
                if (keys.length >= 40) delete cardCache[keys.sort(function (a, b) { return cardCache[a].time - cardCache[b].time; })[0]];
                cardCache[key] = {time: Date.now(), data: clone(data)};
                resolve(clone(data));
            } catch (error) { reject(error); }
        }, reject, false, {dataType: 'text', timeout: 20000});
    }
    function openCard(item) {
        item.softbox_cards = true;
        openSeries(item);
    }
    function openCardRow(row) {
        Lampa.Activity.push({title: row.title, component: 'softbox_view', source: 'softbox', section: row.section, page: 1});
    }
    function moreCard(line, row) {
        if (!row.softbox_row) return;
        row.more = true;
        if (!line.softbox_more) { line.more(); line.softbox_more = true; }
    }
    function CardsMain(object) {
        var comp = new Lampa.InteractionMain(object), request = new Lampa.Reguest(), alive = true;
        var destroy = comp.destroy.bind(comp);
        comp.destroy = function () { alive = false; request.clear(); destroy(); };
        comp.create = function () {
            var pending = cardSections.length, rows = [];
            comp.activity.loader(true);
            function completed(index, data) {
                if (!alive) return;
                if (data && data.results.length) rows[index] = {title: cardSections[index].title,
                    results: data.results.slice(0, 5), more: true, softbox_row: true,
                    section: cardSections[index].section, source: 'softbox', onMore: openCardRow};
                if (!--pending) {
                    comp.activity.loader(false);
                    var ready = rows.filter(function (row) { return !!row; });
                    if (ready.length) comp.build(ready); else { Lampa.Noty.show('Softbox: не удалось загрузить каталог'); comp.empty(); }
                }
            }
            cardSections.forEach(function (section, index) {
                loadCards(request, section.section, 1, function (data) { completed(index, data); }, function () { completed(index); });
            });
            return comp.render();
        };
        comp.onSelect = function (target, item) { openCard(item); };
        comp.onAppend = moreCard;
        var push = comp.push;
        if (push) comp.push = function (line, row) { push.call(comp, line, row); moreCard(line, row); };
        comp.onMore = openCardRow;
        return comp;
    }
    function CardsView(object) {
        var comp = new Lampa.InteractionCategory(object), request = new Lampa.Reguest(), alive = true, seen = Object.create(null);
        var destroy = comp.destroy.bind(comp);
        comp.destroy = function () { alive = false; request.clear(); destroy(); };
        function unique(data) {
            data.results = data.results.filter(function (item) {
                if (seen[item.id]) return false;
                seen[item.id] = true;
                return true;
            });
            return data;
        }
        comp.create = function () {
            comp.activity.loader(true);
            loadCards(request, object.section, 1, function (data) {
                if (!alive) return;
                comp.activity.loader(false);
                seen = Object.create(null);
                comp.build(unique(data));
            }, function () { if (alive) { comp.activity.loader(false); comp.empty(); } });
            return comp.render();
        };
        comp.nextPageReuest = function (query, resolve, reject) {
            var page = query.page;
            loadCards(request, object.section, page, function (data) {
                if (alive) resolve(unique(data));
            }, function () {
                if (!alive) return;
                if (object.page === page) object.page = page - 1;
                Lampa.Noty.show('Softbox: страница не загружена, попробуйте ещё раз');
                reject();
            });
        };
        // InteractionCategory's default handler opens TMDB details; site IDs are NOT TMDB IDs.
        comp.cardRender = function (query, item, card) { card.onEnter = function () { openCard(item); }; };
        return comp;
    }
    if (cardsReady) {
        Lampa.Component.add('softbox_main', CardsMain);
        Lampa.Component.add('softbox_view', CardsView);
        Lampa.Listener.follow('line', function (event) {
            if (event.type !== 'visible' || !event.data || !event.data.softbox_row) return;
            moreCard(event.line, event.data);
            var root = event.line.render && event.line.render(true);
            if (!root || !root.querySelector) return;
            var poster = root.querySelector('.card__view'), more = root.querySelector('.card-more'), box = root.querySelector('.card-more__box');
            if (poster && more && box) {
                var rect = poster.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) { more.style.width = rect.width + 'px'; box.style.height = rect.height + 'px'; }
            }
        });
    }
    function openCards() {
        if (cardsReady) Lampa.Activity.push({title: 'SOFTBOX', component: 'softbox_main', source: 'softbox', page: 1});
        else openSiteCatalogue();
    }
    function addMenu() {
        var menu = $('.menu .menu__list').eq(0);
        if (!menu.length || $('[data-softbox-test]').length) return;
        var item = $('<li class="menu__item selector" data-softbox-test="1"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/></svg></div><div class="menu__text">SOFTBOX</div></li>');
        item.on('hover:enter', openCards);
        if (cardsReady) item.on('hover:long', open);
        menu.append(item);
    }
    if (window.appready) addMenu();
    Lampa.Listener.follow('app', function (event) { if (event.type === 'ready') addMenu(); });
}());
