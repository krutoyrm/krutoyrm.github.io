/* test 0.5.0 — independent direct-host online provider for Lampa. No Lampac proxy. */
(function () {
    'use strict';
    function decode(s) { return String(s || '').replace(/&amp;|&#0*38;/g, '&').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
    function text(s) { return decode(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(); }
    function search(html) {
        var out = [], seen = {}, re = /<a\b([^>]*\bclass=["'][^"']*\barticles__item\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi, m;
        while ((m = re.exec(html))) {
            var href = /\bhref=["']([^"']+)["']/.exec(m[1]), name = /class=["']articles__title["'][^>]*>([\s\S]*?)<\/div>/i.exec(m[2]);
            if (!href || !name || !/^https:\/\/doramyklyb\.ru\/[a-z0-9-]+\/$/i.test(href[1]) || seen[href[1]]) continue;
            seen[href[1]] = true;
            out.push({title: text(name[1]), url: href[1]});
        }
        return out;
    }
    function catalogue(html, page) {
        page = +page;
        if (!isFinite(page) || page < 1 || page > 10000 || page % 1) throw new Error('Неверная страница каталога');
        var items = search(html), pages = page, re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi, m;
        while ((m = re.exec(html))) {
            var a = attrs(m[1]), href = a.href || '', n = /^https:\/\/doramyklyb\.ru\/page\/(\d+)\/$/.exec(href);
            if (n && +n[1] <= 10000) pages = Math.max(pages, +n[1]);
            if (!/\barticles__item\b/.test(a['class'] || '')) continue;
            var image = /<img\b([^>]*)>/i.exec(m[2]), imageAttrs = image ? attrs(image[1]) : {}, poster = imageAttrs['data-src'] || imageAttrs.src || '';
            if (!/^https:\/\/doramyklyb\.ru\/wp-content\/uploads\/[^\s"<>]+$/i.test(poster)) poster = '';
            items.forEach(function (item) { if (item.url === href) item.poster = poster; });
        }
        items.forEach(function (item) {
            item.id = item.url; item.name = item.title; item.source_url = item.url;
            var year = /-(19\d{2}|20\d{2})\/$/.exec(item.url);
            item.first_air_date = year ? year[1] + '-01-01' : '';
        });
        return {items:items, page:page, pages:pages, next:page < pages ? page + 1 : null};
    }
    function providers(html) {
        var out = [], seen = {}, re = /\bdata-iframe\s*=\s*(["'])(.*?)\1/gi, m;
        while ((m = re.exec(html))) {
            var url = decode(m[2]);
            if (url.indexOf('//') === 0) url = 'https:' + url;
            if (!/^https:\/\/[^\s<>"']+$/i.test(url) || seen[url] || /youtube\.com\//i.test(url)) continue;
            var host = url.split('/')[2].toLowerCase(), id = 'unknown', title = 'Неизвестный хостинг';
            if (/(^|\.)stravers\.live$/.test(host)) { id = 'alloha'; title = 'Alloha'; }
            else if (/(^|\.)(nextembed\.ws|embess\.ws|collaps\.[a-z]+)$/.test(host)) { id = 'collaps'; title = 'Collaps'; }
            else if (/(^|\.)obrut\.show$/.test(host)) { id = 'turbo'; title = 'Turbo'; }
            else if (/(^|\.)kodik(?:player)?\.com$/.test(host)) { id = 'kodik'; title = 'Kodik'; }
            seen[url] = true;
            out.push({id: id, title: title, url: url});
        }
        return out;
    }
    // Read JSON only. Never eval downloaded player scripts.
    function jsonAt(s, start) {
        var depth = 0, quote = false, escaped = false;
        for (var i = start; i < s.length; i++) {
            var c = s.charAt(i);
            if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quote = false; }
            else if (c === '"') quote = true;
            else if (c === '[' || c === '{') depth++;
            else if ((c === ']' || c === '}') && !--depth) return JSON.parse(s.slice(start, i + 1));
        }
        throw new Error('Неполные данные плеера');
    }
    function collaps(html) {
        var m = /\bseasons\s*:\s*(\[)/.exec(html), out = [];
        var suffix = /\bvar\s+lok\s*=\s*\d+\s*,\s*[\w$]+\s*=\s*"([a-f0-9]+)"/.exec(html);
        function add(e, season) {
            if (e.blocked || !/^https:\/\/[^\s"<>]+\.m3u8(?:\?|$)/i.test(e.hls || '')) return;
            out.push({title: (season ? season + ' сезон · ' + e.episode + ' серия' : e.title || 'Фильм'), season: season || 0, episode: e.episode,
                url: e.hls + (suffix ? (e.hls.indexOf('?') >= 0 ? '&' : '?') + suffix[1] : ''),
                audio: e.audio && e.audio.names || [], subtitles: (e.cc || []).filter(function (s) { return /^https:\/\//.test(s.url || ''); }).map(function (s) { return {label: s.name, url: s.url}; })});
        }
        if (m) jsonAt(html, m.index + m[0].length - 1).forEach(function (s) { if (!s.blocked) (s.episodes || []).forEach(function (e) { add(e, s.season); }); });
        else {
            m = /\bsource\s*:\s*(\{)/.exec(html);
            if (m) add(jsonAt(html, m.index + m[0].length - 1), 0);
        }
        if (!out.length) throw new Error('Collaps не выдал доступные HLS-потоки');
        return out;
    }
    function attrs(s) {
        var a = {}, re = /([\w-]+)\s*=\s*(["'])(.*?)\2/g, m;
        while ((m = re.exec(s))) a[m[1]] = decode(m[3]);
        return a;
    }
    function kodikMenu(html) {
        var episodes = [], voices = [], seen = {}, m, re = /<div\b[^>]*class=["']season-(\d+)["'][^>]*>([\s\S]*?)<\/div>/gi;
        function options(block, season) {
            var r = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi, o;
            while ((o = r.exec(block))) {
                var a = attrs(o[1]), id = a['data-id'], hash = a['data-hash'], key = season + ':' + a.value;
                if (!/^\d+$/.test(id || '') || !/^[a-f0-9]+$/.test(hash || '') || seen[key]) continue;
                seen[key] = true;
                episodes.push({title: season + ' сезон · ' + text(o[2]), season: +season, episode: a.value,
                    url: 'https://kodikplayer.com/seria/' + id + '/' + hash + '/720p'});
            }
        }
        while ((m = re.exec(html))) options(m[2], m[1]);
        re = /<option\b([^>]*\bdata-media-id\s*=[^>]*)>([\s\S]*?)<\/option>/gi;
        while ((m = re.exec(html))) {
            var a = attrs(m[1]), id = a['data-media-id'], hash = a['data-media-hash'], type = a['data-media-type'];
            if (/^\d+$/.test(id || '') && /^[a-f0-9]+$/.test(hash || '') && /^(serial|video)$/.test(type || ''))
                voices.push({title: a['data-title'] || text(m[2]), url: 'https://kodikplayer.com/' + type + '/' + id + '/' + hash + '/720p'});
        }
        episodes.sort(function (a, b) { return a.season - b.season || (+a.episode) - (+b.episode); });
        return {episodes: episodes, voices: voices};
    }
    function kodikParams(html) {
        var m = /\burlParams\s*=\s*'(\{[^\n]*?\})'/.exec(html);
        if (!m) throw new Error('Kodik: подписи страницы недоступны');
        var params = JSON.parse(m[1]), out = {}, re = /\bvInfo\.(type|hash|id)\s*=\s*['"]([^'"]+)['"]/g;
        while ((m = re.exec(html))) out[m[1]] = m[2];
        ['d', 'd_sign', 'pd', 'pd_sign', 'ref', 'ref_sign'].forEach(function (key) {
            if (typeof params[key] !== 'string' || !params[key]) throw new Error('Kodik: отсутствуют подписи');
            out[key] = key === 'ref' ? decodeURIComponent(params[key]) : params[key];
        });
        if (!out.type || !out.hash || !out.id) throw new Error('Kodik: нет данных видео');
        out.bad_user = 'true'; out.cdn_is_working = 'true';
        return out;
    }
    function kodikStreams(data) {
        if (typeof data === 'string') data = JSON.parse(data);
        var quality = {}, best = 0, url = '';
        function media(value) {
            if (value.indexOf('//') === 0) value = 'https:' + value;
            return /^https:\/\/[^\s<>"'\\]+\.m3u8(?:\?[^\s<>"'\\]*)?$/.test(value) ? value : '';
        }
        Object.keys(data.links || {}).forEach(function (key) {
            if (!/^\d+$/.test(key)) return;
            var variants = data.links[key];
            (Array.isArray(variants) ? variants : []).some(function (v) {
                var src = v.src, decoded = typeof src === 'string' ? media(src) : '';
                if (!src) return false;
                for (var shift = 0; !decoded && shift < 26; shift++) {
                    var base = src.replace(/[a-z]/gi, function (c) {
                        var first = c <= 'Z' ? 65 : 97;
                        return String.fromCharCode((c.charCodeAt(0) - first + shift) % 26 + first);
                    });
                    try { decoded = media(atob(base + '==='.slice((base.length + 3) % 4))); } catch (ignore) { /* Try the next rotation. */ }
                }
                if (!decoded) return false;
                quality[key + 'p'] = decoded;
                if (+key > best) { best = +key; url = decoded; }
                return true;
            });
        });
        if (!url) throw new Error('Kodik не выдал доступные HLS-потоки');
        return {url: url, quality: quality};
    }
    function allohaPage(html) {
        var meta = /<meta\b[^>]*name=["']viewporti["'][^>]*content=["']([^"']+)["']/i.exec(html);
        var token = /\bconst\s+userParam\s*=\s*\{[\s\S]*?\btoken:\s*'([^']+)'/.exec(html);
        var list = /\bconst\s+fileList\s*=\s*JSON\.parse\('((?:\\.|[^'\\])*)'\)/.exec(html);
        if (!meta || !token || !list) throw new Error('Alloha: изменился формат страницы');
        // Decode a quoted data literal, never execute the remote script.
        var raw = list[1].replace(/\\(x[0-9a-f]{2}|u[0-9a-f]{4}|[\s\S])/gi, function (_, c) {
            if (/^[xu]/.test(c) && c.length > 1) return String.fromCharCode(parseInt(c.slice(1), 16));
            return ({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'})[c] || c;
        });
        var files = JSON.parse(raw), episodes = [], source = decode(meta[1]);
        if (source.length > 2048 || source.length < 8) throw new Error('Alloha: неверная подпись страницы');
        function regroup(s, group, descending) {
            var order = [], out = [];
            for (var i=0;i<s.length;i++) order.push(i);
            order.sort(function(a,b){return (descending ? -1 : 1)*(group(a)-group(b)) || a-b;});
            order.forEach(function(index,k){out[index]=s.charAt(k);}); return out.join('');
        }
        var bits = Math.ceil(Math.log(source.length)/Math.LN2);
        source = regroup(source, function(i){return i ? Math.floor(Math.log(i)/Math.LN2)+1 : 0;}, true);
        source = regroup(source, function(i){if(!i)return bits;var n=0;while(i%2===0){n++;i/=2;}return n;});
        var prime=source.length+1;
        function isPrime(n){for(var k=2;k*k<=n;k++)if(n%k===0)return false;return n>=2;}
        while(!isPrime(prime))prime++;
        var out=[], position=0, count=0;
        while(count<source.length){position=(position+2)%prime;if(position<source.length)out[position]=source.charAt(count++);}
        Object.keys(files.all || {}).sort(function(a,b){return a-b;}).forEach(function(season){
            Object.keys(files.all[season]).sort(function(a,b){return a-b;}).forEach(function(ep){
                var voices=files.all[season][ep], entry=voices[Object.keys(voices)[0]];
                if(entry && /^\d+$/.test(String(entry.id)))episodes.push({id:entry.id,season:+season,episode:+ep,title:season+' сезон · '+ep+' серия'});
            });
        });
        if(!episodes.length && files.active && /^\d+$/.test(String(files.active.id)))episodes.push({id:files.active.id,title:'Фильм'});
        if(!episodes.length)throw new Error('Alloha: нет доступных серий');
        return {token:token[1],episodes:episodes,borth:Array(65).join('a')+'|'+out.join('')};
    }
    function allohaStreams(answer) {
        var data = typeof answer === 'string' ? JSON.parse(answer) : answer, out = [];
        var subtitles = (data.tracks || []).filter(function (s) { return s.kind === 'subtitles' && /^https:\/\/[^\s"<>]+$/i.test(s.src || ''); })
            .map(function (s) { return {label: s.label || s.language || 'Субтитры', url: s.src}; });
        (data.hlsSource || []).forEach(function (voice) {
            var quality = {}, best = 0, url = '';
            Object.keys(voice.quality || {}).forEach(function (key) {
                var src = voice.quality[key];
                var local = /^http:\/\/127\.0\.0\.1:18765\/stream\/[a-zA-Z0-9_-]+(?:\.m3u8)?$/.test(src || '');
                if (!/^\d+$/.test(key) || (!local && !/^https:\/\/[^\s"<>]+$/i.test(src || ''))) return;
                quality[key + 'p'] = src;
                if (+key > best) { best = +key; url = src; }
            });
            if (url) out.push({title: voice.label || 'Озвучка', audioId: voice.audioId, url: url, quality: quality, subtitles: subtitles});
        });
        if (!out.length) throw new Error('Alloha не выдал доступные HLS-потоки');
        return out;
    }
    var api = {catalogue: catalogue, allohaPage: allohaPage, allohaStreams: allohaStreams, search: search, providers: providers, jsonAt: jsonAt, collaps: collaps,
        kodikMenu: kodikMenu, kodikParams: kodikParams, kodikStreams: kodikStreams};
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
    if (window.krutoyrm_test_ready) return;
    window.krutoyrm_test_ready = true;
    var network = new Lampa.Reguest(), generation = 0, screen;
    // Use Lampa's own Explorer: the same poster, information panel and spacing as Online.
    function Online(object) {
        var self = this, explorer = new Lampa.Explorer(object), scroll = new Lampa.Scroll({mask:true, over:true});
        var toolbar = $('<div class="test-online__filters"></div>'), list = $('<div class="test-online__list"></div>');
        var hosts = [], hostAction, host, voices = [], voiceAction, voice, episodes = [], episodeAction, activeEpisode;
        var seasons = [], season, last, started = false, dead = false;
        this.dead = function () { return dead; };
        explorer.render().addClass('test-online');
        explorer.appendHead(toolbar); scroll.append(list); explorer.appendFiles(scroll.render());
        scroll.minus(explorer.render().find('.explorer__files-head'));
        scroll.onWheel = function (step) { scroll.wheel(step); };
        function focus(element) { last = element; if ($(element).closest('.test-online__list').length) scroll.update(element, true); }
        function button(title, action) {
            var item = $('<div class="simple-button simple-button--filter selector"></div>').text(title);
            item.on('hover:enter', action).on('hover:focus', function () { focus(this); }); toolbar.append(item);
        }
        function popup(title, items, current, action) {
            Lampa.Select.show({title:title, items:items.map(function (item) { return Object.assign({}, item, {selected:item === current || item.selected === true}); }),
                onBack:function () { Lampa.Controller.toggle('content'); },
                onSelect:function (item) { Lampa.Select.close(); action(item); }});
        }
        function chooseHost(item) {
            generation++; network.clear();
            host = item; voices = []; voice = null; episodes = []; seasons = []; season = null; last = null; activeEpisode = null;
            self.message('Загрузка серий…'); self.activity.loader(true); filters(); hostAction(item);
        }
        function filters() {
            toolbar.empty();
            button('Назад', function () { Lampa.Activity.backward(); });
            if (hosts.length) button(host ? host.title : 'Источник', function () { popup('Источник', hosts, host, chooseHost); });
            if (voices.length) button('Озвучка: ' + (voice ? voice.title : 'выбрать'), function () {
                popup('Озвучка', voices, voice, function (item) {
                    voice = item; filters();
                    // Alloha's signed media must be refreshed, never replayed from a cached filter item.
                    if (item.quality && activeEpisode) { self.activity.loader(true); episodeAction(activeEpisode); }
                    else voiceAction(item);
                });
            });
            if (seasons.length) button('Сезон ' + season, function () {
                popup('Сезон', seasons.map(function (s) { return {title:'Сезон ' + s, season:s, selected:s === season}; }), null,
                    function (item) { season = item.season; last = null; filters(); rows(); });
            });
        }
        function rows() {
            list.empty();
            episodes.filter(function (item) { return !item.season || item.season === season; }).forEach(function (item) {
                var row = $('<div class="test-online__episode selector"><div class="test-online__episode-title"></div><div class="test-online__episode-info"></div></div>');
                row.find('.test-online__episode-title').text(item.title);
                row.find('.test-online__episode-info').text((host ? host.title : 'Выберите совпадение') + (voice ? ' · ' + voice.title : '') + (item.season ? ' · Сезон ' + item.season : ''));
                row.on('hover:focus', function () { focus(this); });
                row.on('hover:enter', function () { activeEpisode = item; self.activity.loader(true); episodeAction(item); }); list.append(row);
            });
            if (!list.children().length) self.message('Серии не найдены. Выберите другой источник.');
            self.activity.loader(false); Lampa.Controller.toggle('content');
        }
        this.message = function (message) {
            list.empty().append($('<div class="test-online__empty selector"></div>').text(message));
            self.activity.loader(false); last = null;
        };
        this.present = function (title, items, action) {
            if (dead) return;
            self.activity.loader(false);
            if (items.length && items[0].id && items[0].url) {
                hosts = items; hostAction = action;
                chooseHost(items.filter(function (item) { return item.id === 'collaps'; })[0] || items[0]); return;
            }
            if (/^(?:Kodik|Alloha) · озвучка$/i.test(title)) {
                voices = items; voiceAction = action;
                var selected = voices.filter(function (item) { return voice && item.title === voice.title; })[0] || voices[0];
                voice = selected; filters(); if (episodes.length) rows(); if (selected) action(selected); return;
            }
            episodes = items; episodeAction = action; seasons = [];
            items.forEach(function (item) { if (item.season && seasons.indexOf(item.season) < 0) seasons.push(item.season); });
            seasons.sort(function (a,b) { return a-b; });
            if (seasons.indexOf(season) < 0) season = seasons[0];
            last = null; filters(); rows();
        };
        this.create = function () { return this.render(); };
        this.start = function () {
            screen = self;
            Lampa.Controller.add('content', {
                toggle:function () { var content = explorer.render().find('.explorer__files-head').parent(); Lampa.Controller.collectionSet(content); Lampa.Controller.collectionFocus(last || false, content); },
                up:function () { if (window.Navigator.canmove('up')) window.Navigator.move('up'); else Lampa.Controller.toggle('head'); },
                down:function () { window.Navigator.move('down'); },
                left:function () { if (window.Navigator.canmove('left')) window.Navigator.move('left'); else explorer.toggle(); },
                right:function () { window.Navigator.move('right'); },
                back:function () { Lampa.Activity.backward(); }
            });
            if (!started) { started = true; filters(); self.message('Поиск источников…'); load(object.movie); }
            Lampa.Controller.toggle('content');
        };
        this.render = function () { return explorer.render(); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () {
            dead = true; generation++; network.clear(); if (screen === self) screen = null;
            scroll.destroy(); explorer.destroy();
        };
    }

    function back() { generation++; network.clear(); Lampa.Controller.toggle('full'); }
    function fail(message) { if (screen && !screen.dead()) { screen.message(message); Lampa.Controller.toggle('content'); } Lampa.Noty.show('test: ' + message); }
    function get(url, done, token, post, headers) {
        var helper = /^http:\/\/127\.0\.0\.1:18765\/resolve\?/.test(url), timeout = helper ? 60000 : 20000;
        network.timeout(timeout);
        network.native(url, function (html) { if (token !== generation) return; if (screen && !screen.dead()) screen.activity.loader(false); try { done(html); } catch (e) { fail(e.message); } },
            function () { if (token === generation) fail(helper ? 'Alloha: недоступен помощник на ПК. Запустите start_tv.cmd.' : 'Источник недоступен. Повторите выбор или выберите другой хостинг.'); }, post || false,
            {dataType: 'text', timeout: timeout, headers: headers || {Referer: 'https://doramyklyb.ru/'}});
    }
    function openKodik(host, match, returnToHosts) {
        var token = ++generation;
        get(host.url, function (html) {
            var menu = kodikMenu(html);
            function chooseVoice() {
                if (!menu.voices.length) return chooseEpisodes(host, html);
                select('Kodik · озвучка', menu.voices, function (voice) {
                    var voiceToken = ++generation;
                    get(voice.url, function (page) { chooseEpisodes(voice, page); }, voiceToken);
                }, returnToHosts);
            }
            function chooseEpisodes(voice, page) {
                var episodes = kodikMenu(page).episodes;
                if (!episodes.length) episodes = [{title: 'Фильм', url: voice.url}];
                select('Kodik · ' + voice.title, episodes, function (episode) {
                    var playToken = ++generation;
                    get(episode.url, function (fresh) {
                        var params = kodikParams(fresh);
                        get('https://kodikplayer.com/ftor', function (answer) {
                            var media = kodikStreams(answer);
                            media.title = match.title + ' · ' + voice.title + ' · ' + episode.title;
                            media.timeline = true;
                            Lampa.Player.play(media);
                            // Resolve each episode on demand; iframe links must never enter Player.playlist.
                            Lampa.Player.playlist([media]);
                        }, playToken, params, {'Content-Type': 'application/x-www-form-urlencoded', Referer: episode.url,
                            Origin: 'https://kodikplayer.com', 'X-Requested-With': 'XMLHttpRequest'});
                    }, playToken);
                }, chooseVoice);
            }
            chooseVoice();
        }, token);
    }
    function openAlloha(host, match, returnToHosts) {
        var requestToken=++generation;
        get(host.url,function(html){
            var initial=allohaPage(html);
            function chooseEpisode(){select('Alloha · серии',initial.episodes,function(entry){
                var freshToken=++generation;
                var helper='http://127.0.0.1:18765/resolve?source='+encodeURIComponent(match.url)+'&episode='+encodeURIComponent(entry.id);
                get(helper,function(answer){
                    var voices=allohaStreams(answer);
                    select('Alloha · озвучка',voices,function(voice){
                        var media={url:voice.quality['1080p'] || voice.quality['720p'] || voice.url,quality:voice.quality,subtitles:voice.subtitles,title:match.title+' · '+entry.title+' · '+voice.title,timeline:true};
                        Lampa.Player.play(media);Lampa.Player.playlist([media]);
                    },chooseEpisode);
                },freshToken);
            },returnToHosts);}
            chooseEpisode();
        },requestToken);
    }
    function select(title, items, fn, onBack) {
        if (screen && !screen.dead()) return screen.present(title, items, fn);
        Lampa.Select.show({title: title, items: items, onSelect: fn, onBack: onBack || back});
    }
    function openProviders(card, match) {
        var token = ++generation; network.clear();
        get(match.url, function (html) {
            var hosts = providers(html);
            if (!hosts.length) return fail('На странице нет доступных плееров');
            function show() { select('test · ' + match.title, hosts, function (host) {
                if (host.id === 'alloha') return openAlloha(host, match, show);
                if (host.id === 'kodik') return openKodik(host, match, show);
                if (host.id !== 'collaps') return fail(host.title + ': прямое извлечение пока не поддерживается. Выберите Collaps или Kodik.');
                var requestToken = ++generation;
                get(host.url, function (page) {
                    var episodes = collaps(page);
                    function chooseEpisode() { select('Collaps · серии', episodes, function (entry) {
                        // Refresh signed URLs for every launch; do not store expiring links in Storage.
                        var freshToken = ++generation;
                        get(host.url, function (fresh) {
                            var playlist = collaps(fresh), index = -1;
                            playlist.some(function (e, i) { if (e.season === entry.season && String(e.episode) === String(entry.episode)) { index = i; return true; } return false; });
                            if (index < 0) return fail('Серия больше недоступна');
                            var videos = playlist.map(function (e) { return {title: match.title + ' · ' + e.title, url: e.url, subtitles: e.subtitles, timeline: true}; });
                            Lampa.Player.play(videos[index]);
                            Lampa.Player.playlist(videos);
                        }, freshToken);
                    }, show); }
                    chooseEpisode();
                }, requestToken);
            }); }
            show();
        }, token);
    }
    function load(card) {
        // A site catalogue card already identifies the exact series; do not search TMDB or guess a remake.
        if (card.source_url && /^https:\/\/doramyklyb\.ru\/[a-z0-9-]+\/$/i.test(card.source_url)) {
            return openProviders(card, {url:card.source_url, title:card.title || card.name});
        }
        var title = card.title || card.name || card.original_title || card.original_name;
        if (!title) return fail('У карточки нет названия');
        var token = ++generation; network.clear();
        get('https://doramyklyb.ru/?s=' + encodeURIComponent(title), function (html) {
            var matches = search(html);
            if (!matches.length) return fail('На Doramy club ничего не найдено');
            // Never silently select the wrong remake/season from a fuzzy site search.
            select('test · выберите совпадение', matches, function (match) { openProviders(card, match); });
        }, token);
    }
    function open(card) {
        if (!Lampa.Component || !Lampa.Explorer || !Lampa.Scroll) return load(card);
        var movie = Object.assign({}, card, {title:card.title || card.name || card.original_title || card.original_name,
            original_title:card.original_title || card.original_name || ''});
        Lampa.Activity.push({component:'krutoyrm_test_online', title:'test · Онлайн', movie:movie, card:movie});
    }
    if (Lampa.Component && Lampa.Explorer && Lampa.Scroll) {
        Lampa.Component.add('krutoyrm_test_online', Online);
        $('<style id="krutoyrm-test-style">' +
            '.test-online__filters{display:flex;flex-wrap:wrap;gap:.65em;padding-bottom:1em}' +
            '.test-online__filters .simple-button{margin:0}' +
            '.test-online__list{padding:.3em .4em 2em 0}' +
            '.test-online__episode{padding:1.1em 1.35em;margin-bottom:.65em;border:.2em solid transparent;border-radius:.3em;background:rgba(255,255,255,.06)}' +
            '.test-online__episode.focus{border-color:#fff;background:rgba(255,255,255,.14)}' +
            '.test-online__episode-title{font-size:1.2em;font-weight:600}' +
            '.test-online__episode-info{opacity:.6;font-size:.85em;margin-top:.5em}' +
            '.test-online__empty{padding:2em 1em;opacity:.65;line-height:1.5}' +
            '</style>').appendTo('head');
    }
    // Same native catalogue component as Softbox, with a separate request lifetime.
    function Catalogue(object) {
        var comp = new Lampa.InteractionCategory(object), request = new Lampa.Reguest(), alive = true;
        var destroy = comp.destroy.bind(comp), seen = Object.create(null);
        comp.destroy = function () { alive = false; request.clear(); destroy(); };
        function loadPage(page, resolve, reject) {
            if (!Number.isInteger(+page) || +page < 1 || +page > 10000) return reject();
            request.native('https://doramyklyb.ru/' + (+page > 1 ? 'page/' + (+page) + '/' : ''), function (html) {
                if (!alive) return;
                try {
                    var data = catalogue(html, +page);
                    var results = data.items.filter(function (item) { if (seen[item.url]) return false; seen[item.url] = true; return true; });
                    resolve({results:results, page:+page, total_pages:data.pages});
                } catch (error) { reject(error); }
            }, function () { if (alive) reject(); }, false, {dataType:'text', timeout:20000});
        }
        comp.create = function () {
            comp.activity.loader(true);
            loadPage(1, function (data) { comp.activity.loader(false); if (data.results.length) comp.build(data); else comp.empty(); },
                function () { comp.activity.loader(false); comp.empty(); Lampa.Noty.show('Doramy Club: каталог недоступен'); });
            return comp.render();
        };
        comp.nextPageReuest = function (query, resolve, reject) {
            loadPage(query.page, resolve, function () {
                if (object.page === query.page) object.page = query.page - 1;
                Lampa.Noty.show('Doramy Club: повторите загрузку страницы'); reject();
            });
        };
        // Site slugs are not TMDB IDs: always enter our own episode screen.
        comp.cardRender = function (query, item, card) { card.onEnter = function () { open(item); }; };
        return comp;
    }
    function openCatalogue() {
        if (Lampa.InteractionCategory && Lampa.Component) {
            Lampa.Activity.push({title:'Doramy Club', component:'krutoyrm_doramy_catalogue', source:'doramy_club', page:1});
        } else Lampa.Noty.show('Doramy Club: обновите Lampa для каталога');
    }
    if (Lampa.InteractionCategory && Lampa.Component) {
        Lampa.Component.add('krutoyrm_doramy_catalogue', Catalogue);
        function addCatalogueMenu() {
            var menu = $('.menu .menu__list').eq(0);
            if (!menu.length || $('[data-doramy-club-menu]').length) return;
            var item = $('<li class="menu__item selector" data-doramy-club-menu="1"><div class="menu__ico"><svg><use xlink:href="#sprite-play"></use></svg></div><div class="menu__text">Doramy Club</div></li>');
            item.on('hover:enter', openCatalogue); menu.append(item);
        }
        if (window.appready) addCatalogueMenu();
        Lampa.Listener.follow('app', function (event) { if (event.type === 'ready') addCatalogueMenu(); });
    }
    Lampa.Listener.follow('full', function (event) {
        if (event.type !== 'complite' || !event.data || !event.data.movie) return;
        var body = event.body || (event.object && event.object.activity && event.object.activity.render());
        if (!body || !body.find) return;
        var buttons = body.find('.full-start-new__buttons, .full-start__buttons').first();
        if (!buttons.length || body.find('[data-krutoyrm-test]').length) return;
        var button = $('<div class="full-start__button selector view--online" data-krutoyrm-test="1"><svg><use xlink:href="#sprite-play"></use></svg><span>test</span></div>');
        button.on('hover:enter', function () { open(event.data.movie); });
        buttons.append(button);
    });
    window.krutoyrmTest = {open: open, version: '0.5.0'};
}());
