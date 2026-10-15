/* Дорамы для Lampa — krutoyrm, 1.0.2.
 * Independent implementation using Lampa's public component API.
 * Catalogue concept: https://github.com/xxhekpxx2307/Plagins/blob/main/Dorama.js
 */
(function () {
    'use strict';
    if (window.krutoyrm_dorama_ready) return;
    window.krutoyrm_dorama_ready = true;
    console.log('Dorama', '1.0.2 loaded');

    var categories = [
        {title: 'Популярные', params: {'with_genres': '18', 'vote_count.gte': '30'}},
        {title: 'Новинки', params: {'with_genres': '18', sort_by: 'first_air_date.desc', 'first_air_date.lte': '{today}', 'vote_count.gte': '3'}},
        {title: 'Высокий рейтинг', params: {'with_genres': '18', sort_by: 'vote_average.desc', 'vote_average.gte': '7.8', 'vote_count.gte': '200'}},
        {title: 'Комедии', params: {with_genres: '35'}},
        {title: 'Драмы', params: {with_genres: '18'}},
        {title: 'Детективы', params: {with_genres: '9648'}},
        {title: 'Криминал', params: {with_genres: '80'}},
        {title: 'Боевики и приключения', params: {with_genres: '10759'}},
        {title: 'Фантастика и фэнтези', params: {with_genres: '10765'}},
        {title: 'Viki / Rakuten', params: {with_watch_providers: '126', watch_region: 'UA'}}
    ];

    function query(params, page) {
        var values = {api_key: Lampa.TMDB.key(), language: Lampa.Storage.get('language', 'ru'), page: page,
            with_original_language: 'ko|zh|ja', without_genres: '16', sort_by: 'popularity.desc'};
        Object.keys(params || {}).forEach(function (key) {values[key] = params[key];});
        return Lampa.TMDB.api('discover/tv?' + Object.keys(values).map(function (key) {
            var value = values[key];
            if (value === '{today}') {
                var date = new Date();
                value = date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
            }
            return encodeURIComponent(key) + '=' + encodeURIComponent(value);
        }).join('&'));
    }

    var cache = {};
    function copy(value) {return JSON.parse(JSON.stringify(value));}
    function unique(results, seen) {
        seen = seen || Object.create(null);
        return results.filter(function (item) {
            if (!item || !item.id || seen[item.id]) return false;
            seen[item.id] = true;
            return true;
        });
    }
    function load(network, params, page, resolve, reject) {
        var url = query(params, page), now = Date.now(), entry = cache[url];
        Object.keys(cache).forEach(function (key) {if (now - cache[key].time >= 600000) delete cache[key];});
        if (entry && now - entry.time < 600000) {resolve(copy(entry.data)); return;}
        network.timeout(15000);
        network.silent(url, function (json) {
            if (!json || !Array.isArray(json.results)) {reject(); return;}
            json = copy(json);
            json.results = unique(json.results);
            json.total_pages = Math.min(json.total_pages || 0, 500);
            var keys = Object.keys(cache);
            if (keys.length >= 40) delete cache[keys.sort(function (a, b) {return cache[a].time - cache[b].time;})[0]];
            cache[url] = {time: Date.now(), data: copy(json)};
            resolve(copy(json));
        }, reject);
    }

    function openRow(row) {
        Lampa.Activity.push({title: row.title, component: 'krutoyrm_dorama_view', source: 'tmdb',
            url: 'discover/tv', params: row.params, page: 1});
    }
    function addMore(line, row) {
        // NUMParser's global line/append hook rewrites more=false on short rows.
        // Ownership, not that mutable flag, determines our explicit full-list action.
        if (row.krutoyrm_dorama) row.more = true;
        if (row.more && !line.krutoyrm_dorama_more) {
            line.more();
            line.krutoyrm_dorama_more = true;
        }
    }
    Lampa.Listener.follow('line', function (event) {
        if (event.type === 'visible' && event.data && event.data.krutoyrm_dorama) addMore(event.line, event.data);
    });

    function Main(object) {
        var comp = new Lampa.InteractionMain(object), network = new Lampa.Reguest(), alive = true;
        var destroy = comp.destroy.bind(comp);
        comp.destroy = function () {alive = false; network.clear(); destroy();};
        comp.create = function () {
            var pending = categories.length, rows = [];
            comp.activity.loader(true);
            function completed(index, json) {
                if (!alive) return;
                if (json && json.results && json.results.length) {
                    rows[index] = {title: categories[index].title, results: json.results.slice(0, 5), more: true,
                        source: 'tmdb', url: 'discover/tv', params: categories[index].params,
                        krutoyrm_dorama: true, onMore: openRow};
                }
                pending--;
                if (!pending) {
                    var ready = rows.filter(function (row) {return !!row;});
                    comp.activity.loader(false);
                    if (ready.length) {
                        comp.build(ready);
                        console.log('Dorama', '1.0.2 built ' + ready.length + ' rows; More hooks: ' + typeof comp.onAppend + '/' + typeof comp.push);
                    } else comp.empty();
                }
            }
            categories.forEach(function (category, index) {
                load(network, category.params, 1, function (json) {completed(index, json);}, function () {completed(index);});
            });
            return comp.render();
        };
        comp.onAppend = addMore;
        var push = comp.push;
        if (push) comp.push = function (line, row) {
            push.call(comp, line, row);
            addMore(line, row);
        };
        comp.onMore = openRow;
        return comp;
    }
    function View(object) {
        var comp = new Lampa.InteractionCategory(object), network = new Lampa.Reguest(), alive = true, seen = Object.create(null);
        var destroy = comp.destroy.bind(comp);
        comp.destroy = function () {alive = false; network.clear(); destroy();};
        comp.create = function () {
            comp.activity.loader(true);
            load(network, object.params, 1, function (json) {
                if (!alive) return;
                comp.activity.loader(false);
                seen = Object.create(null);
                json.results = unique(json.results, seen);
                if (json.results.length) comp.build(json); else comp.empty();
            }, function () {if (alive) {comp.activity.loader(false); comp.empty();}});
            return comp.render();
        };
        comp.nextPageReuest = function (request, resolve, reject) {
            var page = request.page;
            load(network, object.params, page, function (json) {
                if (!alive) return;
                json.results = unique(json.results, seen);
                resolve(json);
            }, function () {
                if (!alive) return;
                if (object.page === page) object.page = page - 1;
                reject();
            });
        };
        return comp;
    }

    Lampa.Component.add('krutoyrm_dorama_main', Main);
    Lampa.Component.add('krutoyrm_dorama_view', View);

    function addMenu() {
        var menu = $('.menu .menu__list').eq(0);
        if (!menu.length || menu.find('[data-krutoyrm-dorama]').length) return;
        var button = $('<li class="menu__item selector" data-krutoyrm-dorama="true"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/></svg></div><div class="menu__text">Дорамы</div></li>');
        button.on('hover:enter', function () {
            Lampa.Activity.push({title: 'Дорамы', component: 'krutoyrm_dorama_main', source: 'tmdb', page: 1});
        });
        menu.append(button);
    }
    if (window.appready) addMenu();
    Lampa.Listener.follow('app', function (event) {if (event.type === 'ready') addMenu();});
}());
