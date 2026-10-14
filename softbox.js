/* Softbox test plugin, 0.1.0. Only publicly accessible OK.ru embeds. */
(function () {
    'use strict';
    function unescapeHtml(value) {
        return value.replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
    function episodes(text) {
        var result = [], seen = {}, match;
        var pattern = /<li\b([^>]*\bdata-file\s*=\s*(["'])(.*?)\2[^>]*)>([\s\S]*?)<\/li>/gi;
        while ((match = pattern.exec(text))) {
            var url = unescapeHtml(match[3]);
            if (url.indexOf('//') === 0) url = 'https:' + url;
            if (!/^https:\/\/ok\.ru\/videoembed\/\d+(?:\?.*)?$/.test(url) || seen[url]) continue;
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
    var api = {episodes: episodes, streams: streams};
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
    if (typeof Lampa === 'undefined' || window.softbox_test_ready) return;
    window.softbox_test_ready = true;
    var network = new Lampa.Reguest(), busy = false;
    function fail(error) {
        busy = false;
        Lampa.Noty.show('Softbox: ' + (error.message || error.decode_error || 'Ошибка загрузки'));
        Lampa.Controller.toggle('menu');
    }
    function play(episode) {
        busy = true;
        Lampa.Noty.show('Softbox: получаю видеопоток…');
        network.native(episode.url, function (text) {
            try {
                var data = streams(text);
                busy = false;
                data.title = 'Алхимия душ — ' + episode.title + ' · SOFTBOX';
                Lampa.Storage.set('softbox_test_episode', episode.title);
                Lampa.Player.play(data);
            } catch (error) { fail(error); }
        }, fail, false, {dataType: 'text', timeout: 20000});
    }
    function open() {
        if (busy) return;
        busy = true;
        Lampa.Noty.show('Softbox: загружаю серии…');
        network.native('https://softboxdorama.com/engine/ajax/playlists.php?news_id=715&xfield=playlist', function (text) {
            try {
                var json = typeof text === 'string' ? JSON.parse(text.replace(/^\uFEFF/, '')) : text;
                if (!json.success) throw new Error('Список серий недоступен');
                var items = episodes(json.response);
                if (!items.length) throw new Error('Нет доступных серий OK.ru');
                var last = Lampa.Storage.get('softbox_test_episode', '');
                items.forEach(function (item) { item.selected = item.title === last; });
                busy = false;
                Lampa.Select.show({title: 'Алхимия душ · SOFTBOX', items: items, onSelect: play, onBack: function () { Lampa.Controller.toggle('menu'); }});
            } catch (error) { fail(error); }
        }, fail, false, {dataType: 'text', timeout: 20000});
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
