(function() {
    'use strict';

    function _defineProperty(e, r, t) {
        return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[r] = t, e;
    }
    
    function _toPrimitive(t, r) {
        if ("object" != typeof t || !t) return t;
        var e = t[Symbol.toPrimitive];
        if (void 0 !== e) {
            var i = e.call(t, r || "default");
            if ("object" != typeof i) return i;
            throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return ("string" === r ? String : Number)(t);
    }
    
    function _toPropertyKey(t) {
        var i = _toPrimitive(t, "string");
        return "symbol" == typeof i ? i : i + "";
    }
    
    function ownKeys(e, r) {
        var t = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
            var o = Object.getOwnPropertySymbols(e);
            r && (o = o.filter(function(r) {
                return Object.getOwnPropertyDescriptor(e, r).enumerable;
            })), t.push.apply(t, o);
        }
        return t;
    }
    
    function _objectSpread2(e) {
        for (var r = 1; r < arguments.length; r++) {
            var t = null != arguments[r] ? arguments[r] : {};
            r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
                _defineProperty(e, r, t[r]);
            }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
                Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
            });
        }
        return e;
    }

    // TMDB API запрос
    function main(params, oncomplite, onerror) {
        var apiKey = "4ef0d7355d9ffb5151e987764708ce96";
        var apiUrlTMDB = 'https://api.themoviedb.org/3/';
        var apiUrlProxy = 'apitmdb.' + (Lampa.Manifest && Lampa.Manifest.cub_domain ? Lampa.Manifest.cub_domain : 'cub.red') + '/3/';
        
        var request = 'discover/tv?api_key=' + apiKey + '&language=' + Lampa.Storage.field('language') + '&with_original_language=ja';
        
        // Добавляем фильтры
        if (params.status === '0') request += '&with_status=0'; // Returning Series
        if (params.status === '3') request += '&with_status=3'; // Ended
        if (params.year) {
            request += '&first_air_date.gte=' + params.year + '-01-01&first_air_date.lte=' + params.year + '-12-31';
        }
        if (params.season) {
            var year = params.year || new Date().getFullYear();
            var seasons = {
                'winter': { start: year + '-01-01', end: year + '-03-31' },
                'spring': { start: year + '-04-01', end: year + '-06-30' },
                'summer': { start: year + '-07-01', end: year + '-09-30' },
                'fall': { start: year + '-10-01', end: year + '-12-31' }
            };
            var d = seasons[params.season];
            request += '&first_air_date.gte=' + d.start + '&first_air_date.lte=' + d.end;
        }
        if (params.genre) request += '&with_genres=' + params.genre;
        
        // Сортировка
        request += '&sort_by=' + (params.sort || 'popularity.desc');
        request += '&page=' + (params.page || 1);
        
        $.ajax({
            url: Lampa.Storage.field('proxy_tmdb') ? Lampa.Utils.protocol() + apiUrlProxy + request : apiUrlTMDB + request,
            success: function(response) {
                oncomplite(response.results);
            },
            error: function(err) {
                onerror(err);
            }
        });
    }

    // Карточка аниме
    function Card(data) {
        var item = Lampa.Template.get("anime_me-Card", {
            img: data.poster_path ? 'https://image.tmdb.org/t/p/w300' + data.poster_path : '',
            type: data.media_type || 'TV',
            rate: data.vote_average ? data.vote_average.toFixed(1) : '0.0',
            title: data.name || data.original_name || 'Unknown',
            year: data.first_air_date ? data.first_air_date.split('-')[0] : ''
        });
        
        this.render = function() {
            return item;
        };
        this.destroy = function() {
            item.remove();
        };
    }

    // Главный компонент
    function Component$1(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true,
            step: 250
        });
        var items = [];
        var html = $("<div class='anime_me-module'></div>");
        var head = $("<div class='anime_me-head torrent-filter'><div class='anime_me__home simple-button simple-button--filter selector'>Home</div><div class='anime_me__filter simple-button simple-button--filter selector'>Filter</div></div>");
        var body = $('<div class="anime_me-catalog--list category-full"></div>');
        var active, last;

        this.create = function() {
            API.main(object, this.build.bind(this), this.empty.bind(this));
        };

        this.build = function(result) {
            var _this = this;
            scroll.minus();
            scroll.onWheel = function(step) {
                if (!Lampa.Controller.own(_this)) _this.start();
                if (step > 0) Navigator.move('down'); else Navigator.move('up');
            };
            scroll.onEnd = function() {
                object.page++;
                API.main(object, _this.build.bind(_this), _this.empty.bind(_this));
            };
            this.headeraction();
            this.body(result);
            scroll.append(head);
            scroll.append(body);
            html.append(scroll.render(true));
            this.activity.loader(false);
            this.activity.toggle();
        };

        this.headeraction = function() {
            var filters = {};
            
            // Фильтр по статусу
            filters.status = {
                title: 'Status',
                items: [
                    { title: "All", code: "" },
                    { title: "Airing", code: "0" },
                    { title: "Ended", code: "3" }
                ]
            };
            
            // Фильтр по году
            var currentYear = new Date().getFullYear();
            var yearItems = [{ title: "All", code: "" }];
            for (var y = currentYear; y >= 1990; y -= 5) {
                yearItems.push({ title: y + "s", code: y });
            }
            filters.year = {
                title: 'Year',
                items: yearItems
            };
            
            // Фильтр по сезону
            filters.season = {
                title: 'Season',
                items: [
                    { title: "All", code: "" },
                    { title: "Winter", code: "winter" },
                    { title: "Spring", code: "spring" },
                    { title: "Summer", code: "summer" },
                    { title: "Fall", code: "fall" }
                ]
            };
            
            // Фильтр по жанру
            filters.genre = {
                title: 'Genre',
                items: [
                    { title: "All", code: "" },
                    { title: "Action", code: "10759" },
                    { title: "Animation", code: "16" },
                    { title: "Comedy", code: "35" },
                    { title: "Drama", code: "18" },
                    { title: "Fantasy", code: "14" },
                    { title: "Romance", code: "10749" },
                    { title: "Sci-Fi", code: "878" }
                ]
            };
            
            // Сортировка
            filters.sort = {
                title: 'Sort',
                items: [
                    { title: "Popularity", code: "popularity.desc" },
                    { title: "Rating", code: "vote_average.desc" },
                    { title: "Newest", code: "first_air_date.desc" },
                    { title: "Oldest", code: "first_air_date.asc" }
                ]
            };

            var filterElement = head.find('.anime_me__filter');
            
            function queryForTMDB() {
                var query = {};
                filters.status.items.forEach(function(a) {
                    if (a.selected) query.status = a.code;
                });
                filters.year.items.forEach(function(a) {
                    if (a.selected) query.year = a.code;
                });
                filters.season.items.forEach(function(a) {
                    if (a.selected) query.season = a.code;
                });
                filters.genre.items.forEach(function(a) {
                    if (a.selected) query.genre = a.code;
                });
                filters.sort.items.forEach(function(a) {
                    if (a.selected) query.sort = a.code;
                });
                return query;
            }
            
            function selected(where) {
                var title = [];
                where.items.forEach(function(a) {
                    if (a.selected || a.checked) title.push(a.title);
                });
                where.subtitle = title.length ? title.join(', ') : Lampa.Lang.translate('nochoice');
            }
            
            function select(where, a) {
                where.forEach(function(element) {
                    element.selected = false;
                });
                a.selected = true;
            }
            
            function submenu(item, main) {
                Lampa.Select.show({
                    title: item.title,
                    items: item.items,
                    onBack: main,
                    onSelect: function onSelect(a) {
                        select(item.items, a);
                        main();
                    }
                });
            }
            
            function mainMenu() {
                for (var i in filters) selected(filters[i]);
                Lampa.Select.show({
                    title: 'Filters',
                    items: [
                        { title: Lampa.Lang.translate('search_start'), searchAnime: true },
                        filters.status,
                        filters.year,
                        filters.season,
                        filters.genre,
                        filters.sort
                    ],
                    onBack: function onBack() {
                        Lampa.Controller.toggle("content");
                    },
                    onSelect: function onSelect(a) {
                        if (a.searchAnime) {
                            search();
                        } else submenu(a, mainMenu);
                    }
                });
            }
            
            function search() {
                var query = queryForTMDB();
                var params = {
                    url: '',
                    title: 'anime_me',
                    component: 'anime_me',
                    page: 1
                };
                if (query.status) params.status = query.status;
                if (query.year) params.year = query.year;
                if (query.season) params.season = query.season;
                if (query.genre) params.genre = query.genre;
                if (query.sort) params.sort = query.sort;
                
                Lampa.Activity.push(params);
            }
            
            filterElement.on('hover:enter', function() {
                mainMenu();
            });
            
            var homeElement = head.find('.anime_me__home');
            homeElement.on('hover:enter', function() {
                Lampa.Activity.push({
                    url: '',
                    title: 'anime_me',
                    component: 'anime_me',
                    page: 1
                });
            });
        };

        this.empty = function() {
            var empty = new Lampa.Empty();
            html.append(empty.render(true));
            this.start = empty.start;
            this.activity.loader(false);
            this.activity.toggle();
        };

        this.body = function(data) {
            var _this = this;
            data.forEach(function(anime) {
                var item = new Card(anime);
                item.render().on("hover:focus", function() {
                    last = item.render()[0];
                    active = items.indexOf(item);
                    scroll.update(items[active].render(), true);
                }).on("hover:enter", function() {
                    Lampa.Activity.push({
                        url: '',
                        component: 'full',
                        id: anime.id,
                        method: 'tv',
                        card: anime
                    });
                });
                body.append(item.render());
                items.push(item);
            });
        };

        this.start = function() {
            if (Lampa.Activity.active().activity !== this.activity) return;
            Lampa.Controller.add("content", {
                toggle: function toggle() {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                left: function left() {
                    if (Navigator.canmove("left")) Navigator.move("left"); else Lampa.Controller.toggle("menu");
                },
                right: function right() {
                    Navigator.move("right");
                },
                up: function up() {
                    if (Navigator.canmove("up")) Navigator.move("up"); else Lampa.Controller.toggle("head");
                },
                down: function down() {
                    if (Navigator.canmove("down")) Navigator.move("down");
                },
                back: this.back
            });
            Lampa.Controller.toggle("content");
        };

        this.pause = function() {};
        this.stop = function() {};
        
        this.render = function(js) {
            return js ? html : $(html);
        };
        
        this.destroy = function() {
            network.clear();
            Lampa.Arrays.destroy(items);
            scroll.destroy();
            html.remove();
            items = null;
            network = null;
        };
    }

    var API = {
        main: main
    };

    function add() {
        var icon = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path fill="currentColor" fill-rule="evenodd" d="m368.256 214.573l-102.627 187.35c40.554 71.844 73.647 97.07 138.664 94.503c63.67-2.514 136.974-89.127 95.694-163.243L397.205 150.94c-3.676 12.266-25.16 55.748-28.95 63.634M216.393 440.625C104.077 583.676-57.957 425.793 20.85 302.892c0 0 83.895-147.024 116.521-204.303c25.3-44.418 53.644-72.37 90.497-81.33c44.94-10.926 97.565 12.834 125.62 56.167c19.497 30.113 36.752 57.676 6.343 109.738c-3.613 6.184-136.326 248.402-143.438 257.46m8.014-264.595c-30.696-17.696-30.696-62.177 0-79.873s69.273 4.544 69.273 39.936s-38.578 57.633-69.273 39.937" clip-rule="evenodd"/></svg>';
        
        var button = $('<li class="menu__item selector"><div class="menu__ico">' + icon + '</div><div class="menu__text">anime_me</div></li>');
        
        button.on("hover:enter", function() {
            Lampa.Activity.push({
                url: '',
                title: 'anime_me',
                component: 'anime_me',
                page: 1
            });
        });
        
        $(".menu .menu__list").eq(0).append(button);
    }

    function startPlugin() {
        window.plugin_anime_me_ready = true;
        
        var manifest = {
            type: "other",
            version: "1.0",
            name: "Anime Me",
            description: "Anime catalog with filters",
            component: "anime_me"
        };
        
        Lampa.Manifest.plugins = manifest;
        
        // Стили
        Lampa.Template.add('anime_meStyle', "<style>.anime_me-catalog--list.category-full{-webkit-box-pack:justify !important;-webkit-justify-content:space-between !important;-ms-flex-pack:justify !important;justify-content:space-between !important}.anime_me-head.torrent-filter{margin-left:1.5em}.anime_me .card__vote{position:absolute;right:0;top:0;background:#ffe216;color:#000;padding:.4em;font-size:.8em;font-weight:700}.anime_me .card__year{position:absolute;left:0;top:0;background:#05f;color:#fff;padding:.4em;font-size:.8em}</style>");
        
        // Шаблон карточки
        Lampa.Template.add("anime_me-Card", "<div class=\"anime_me card selector layer--visible layer--render\"><div class=\"anime_me card__view\"><img src=\"{img}\" class=\"anime_me card__img\" /><div class=\"anime_me card__vote\">{rate}</div><div class=\"anime_me card__year\">{year}</div></div><div class=\"anime_me card__title\">{title}</div></div>");
        
        Lampa.Component.add(manifest.component, Component$1);
        
        $('body').append(Lampa.Template.get('anime_meStyle', {}, true));
        
        if (window.appready) add();
        else {
            Lampa.Listener.follow("app", function(e) {
                if (e.type === "ready") add();
            });
        }
    }
    
    if (!window.plugin_anime_me_ready) startPlugin();
})();
