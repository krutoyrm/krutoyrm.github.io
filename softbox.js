/* Softbox test plugin, 0.4.0. Public metadata; verified SOFTBOX; minimum 1080p. */
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
    var api = {episodes: episodes, streams: streams, vkStreams: vkStreams, mailStreams: mailStreams, fanEpisodes: fanEpisodes, fanStreams: fanStreams, strict1080: strict1080};
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
        {title: 'FanSerials — Аварийная посадка любви · SOFTBOX 1080p', source: 'fan', id: 1267353, name: 'Аварийная посадка любви', fallback: [624609, 624617, 624618, 631794, 631795, 631796, 631797, 631798, 631799, 624610, 624611, 624612, 624613, 624614, 624615, 624616].map(function (id, index) {
            // Verified public SOFTBOX voice 143 mapping; never cache signed playback URLs.
            return {title: '1 сезон · ' + (index + 1) + ' серия', video_id: String(id), voice: 'SOFTBOX'};
        })}
    ];
    var network = new Lampa.Reguest(), busy = false, current = sources[0];
    function fail(error) {
        busy = false;
        Lampa.Noty.show('Softbox: ' + (error && (error.message || error.decode_error || (error.status === 404 && 'Видео удалено или недоступно (404)')) || 'Ошибка загрузки'));
        Lampa.Controller.toggle('menu');
    }
    var fanOptions = {dataType: 'text', timeout: 20000, headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        'Origin': 'https://chudottvorcu-lordfilm.ru', 'Referer': 'https://chudottvorcu-lordfilm.ru/'
    }};
    function finish(data, episode, source) {
        data = strict1080(data);
        data.title = source.name + ' — ' + episode.title + ' · SOFTBOX';
        Lampa.Storage.set('softbox_test_episode_' + source.source, episode.title);
        busy = false;
        Lampa.Player.play(data);
    }
    function play(episode) {
        if (busy) return;
        var source = current;
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
    function openSeries(source) {
        if (busy) return;
        current = source;
        if (source.source === 'fan') {
            busy = true;
            function showFan(items) {
                var last = Lampa.Storage.get('softbox_test_episode_fan', '');
                items.forEach(function (item) { item.selected = item.title === last; });
                busy = false;
                Lampa.Select.show({title: source.name + ' · SOFTBOX · 1080p+', items: items, onSelect: play, onBack: open});
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
        Lampa.Select.show({title: 'Softbox тест · 0.4.0', items: sources, onSelect: openSeries, onBack: function () { Lampa.Controller.toggle('menu'); }});
    }
    function addMenu() {
        var menu = $('.menu .menu__list').eq(0);
        if (!menu.length || $('[data-softbox-test]').length) return;
        var item = $('<li class="menu__item selector" data-softbox-test="1"><div class="menu__ico">SB</div><div class="menu__text">Softbox тест</div></li>');
        item.on('hover:enter', open);
        menu.append(item);
    }
    if (window.appready) addMenu();
    Lampa.Listener.follow('app', function (event) { if (event.type === 'ready') addMenu(); });
}());
