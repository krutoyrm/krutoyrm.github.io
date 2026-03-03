(function () {
    'use strict';

    const TMDB = Lampa.TMDB;

    const FILTER_DEFAULTS = {
        type: 'all',
        year_from: '',
        year_to: '',
        rating: '',
        sort: 'popularity.desc',
        status: ''
    };

    let currentFilter = Object.assign({}, FILTER_DEFAULTS);
    let currentCategory = null;

    const GENRES = [
        { title: "Все жанры", id: "" },
        { title: "Экшен", id: "28" },
        { title: "Приключения", id: "12" },
        { title: "Комедия", id: "35" },
        { title: "Драма", id: "18" },
        { title: "Фэнтези", id: "14" },
        { title: "Научная фантастика", id: "878" },
        { title: "Детектив", id: "9648" },
        { title: "Романтика", id: "10749" },
        { title: "Анимация", id: "16" },
        { title: "Ужасы", id: "27" },
        { title: "Триллер", id: "53" },
        { title: "Криминал", id: "80" }
    ];

    function createMenuItem() {
        const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path fill="currentColor" fill-rule="evenodd" d="m368.256 214.573l-102.627 187.35c40.554 71.844 73.647 97.07 138.664 94.503c63.67-2.514 136.974-89.127 95.694-163.243L397.205 150.94c-3.676 12.266-25.16 55.748-28.95 63.634M216.393 440.625C104.077 583.676-57.957 425.793 20.85 302.892c0 0 83.895-147.024 116.521-204.303c25.3-44.418 53.644-72.37 90.497-81.33c44.94-10.926 97.565 12.834 125.62 56.167c19.497 30.113 36.752 57.676 6.343 109.738c-3.613 6.184-136.326 248.402-143.438 257.46m8.014-264.595c-30.696-17.696-30.696-62.177 0-79.873s69.273 4.544 69.273 39.936s-38.578 57.633-69.273 39.937" clip-rule="evenodd"/></svg>`;

        const item = $(`
            <li class="menu__item selector" data-action="anime_rmk">
                <div class="menu__ico">${icon}</div>
                <div class="menu__text">Аниме RMK</div>
            </li>
        `);

        item.on('hover:enter', () => {
            openAnimeCatalog();
        });

        $('.menu .menu__list').eq(0).append(item);
    }

    function openAnimeCatalog() {
        Lampa.Activity.push({
            url: '',
            title: 'Аниме RMK',
            component: 'anime_rmk_catalog',
            category: { id: 'popular', title: 'Популярное' },
            filter: Object.assign({}, currentFilter),
            page: 1
        });
    }

    function openRootMenu() {
        const categories = [
            { title: "Популярное", id: "popular" },
            { title: "Топ‑100", id: "top100" },
            { title: "Жанры", id: "genres" },
            { title: "Рекомендации TMDB", id: "trending" }
        ];

        Lampa.Select.show({
            title: 'Аниме RMK',
            items: categories,
            onSelect: (item) => {
                if (item.id === 'genres') {
                    showGenres();
                } else {
                    currentCategory = item;
                    Lampa.Activity.push({
                        url: '',
                        title: item.title,
                        component: 'anime_rmk_catalog',
                        category: item,
                        filter: Object.assign({}, currentFilter),
                        page: 1
                    });
                }
            },
            onBack: () => {
                Lampa.Controller.toggle('menu');
            }
        });
    }

    function showGenres() {
        Lampa.Select.show({
            title: 'Жанры',
            items: GENRES.filter(g => g.id),
            onSelect: (g) => {
                currentCategory = { id: 'genre', title: g.title, genre: g };
                Lampa.Activity.push({
                    url: '',
                    title: g.title,
                    component: 'anime_rmk_catalog',
                    category: currentCategory,
                    filter: Object.assign({}, currentFilter, { genre: g.id }),
                    page: 1
                });
            },
            onBack: openRootMenu
        });
    }

    Lampa.Component.add('anime_rmk_catalog', function () {
        let comp = this;
        let activity = Lampa.Activity.current();
        let category = activity.category || { id: 'popular', title: 'Аниме RMK' };
        let filter = activity.filter || Object.assign({}, FILTER_DEFAULTS);
        currentFilter = Object.assign({}, filter);
        currentCategory = category;

        let body = $('<div class="category category_full"></div>');
        let scroll = new Lampa.Scroll({ mask: true });
        let last_page = 1;
        let loading = false;
        let finished = false;

        scroll.body().addClass('category__body');
        body.append(scroll.render());

        comp.create = function () {
            comp.activity.loader(true);
            buildHeader();
            loadPage(1, () => {
                comp.activity.loader(false);
                comp.activity.toggle();
            });
            return body;
        };

        function buildHeader() {
            let header = $('<div class="category__head"></div>');
            let title = $('<div class="category__title"></div>').text(activity.title || 'Аниме RMK');
            let buttons = $('<div class="category__head-actions"></div>');

            let home_btn = $('<div class="category__head-button selector">Домой</div>');
            let filter_btn = $('<div class="category__head-button selector">Фильтр</div>');

            home_btn.on('hover:enter', () => {
                openRootMenu();
            });

            filter_btn.on('hover:enter', () => {
                openFilterScreen();
            });

            buttons.append(home_btn).append(filter_btn);
            header.append(title).append(buttons);
            body.prepend(header);
        }

        function openFilterScreen() {
            let items = [
                {
                    title: 'Тип',
                    subtitle: filterTypeTitle(currentFilter.type),
                    id: 'type'
                },
                {
                    title: 'Жанр',
                    subtitle: getGenreTitle(currentFilter.genre),
                    id: 'genre'
                },
                {
                    title: 'Год от',
                    subtitle: currentFilter.year_from || 'Любой',
                    id: 'year_from'
                },
                {
                    title: 'Год до',
                    subtitle: currentFilter.year_to || 'Любой',
                    id: 'year_to'
                },
                {
                    title: 'Рейтинг',
                    subtitle: currentFilter.rating ? currentFilter.rating + '+' : 'Любой',
                    id: 'rating'
                },
                {
                    title: 'Сортировка',
                    subtitle: sortTitle(currentFilter.sort),
                    id: 'sort'
                },
                {
                    title: 'Статус',
                    subtitle: currentFilter.status || 'Любой',
                    id: 'status'
                },
                {
                    title: 'Применить',
                    id: 'apply'
                }
            ];

            Lampa.Select.show({
                title: 'Фильтр',
                items: items,
                onSelect: (it) => {
                    if (it.id === 'type') selectType();
                    else if (it.id === 'genre') selectGenre();
                    else if (it.id === 'year_from') selectYearFrom();
                    else if (it.id === 'year_to') selectYearTo();
                    else if (it.id === 'rating') selectRating();
                    else if (it.id === 'sort') selectSort();
                    else if (it.id === 'status') selectStatus();
                    else if (it.id === 'apply') applyFilter();
                },
                onBack: () => {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        function filterTypeTitle(type) {
            if (type === 'tv') return 'Сериал';
            if (type === 'movie') return 'Фильм';
            return 'Все';
        }

        function getGenreTitle(genreId) {
            if (!genreId) return 'Любой';
            let genre = GENRES.find(g => g.id === genreId);
            return genre ? genre.title : 'Любой';
        }

        function sortTitle(sort) {
            switch (sort) {
                case 'popularity.desc': return 'Популярность';
                case 'vote_average.desc': return 'Рейтинг';
                case 'first_air_date.desc': return 'Дата выхода';
                case 'vote_count.desc': return 'Количество голосов';
                case 'created_at.desc': return 'Дата добавления';
                default: return 'Популярность';
            }
        }

        function selectType() {
            let items = [
                { title: 'Все', type: 'all' },
                { title: 'Сериал', type: 'tv' },
                { title: 'Фильм', type: 'movie' }
            ];
            Lampa.Select.show({
                title: 'Тип',
                items: items,
                onSelect: (it) => {
                    currentFilter.type = it.type;
                    openFilterScreen();
                },
                onBack: openFilterScreen
            });
        }

        function selectGenre() {
            Lampa.Select.show({
                title: 'Жанр',
                items: GENRES,
                onSelect: (it) => {
                    currentFilter.genre = it.id;
                    openFilterScreen();
                },
                onBack: openFilterScreen
            });
        }

        function selectYearFrom() {
            let years = [];
            let now = new Date().getFullYear();
            for (let y = now; y >= 1960; y--) {
                years.push({ title: String(y), year: String(y) });
            }
            years.unshift({ title: 'Любой', year: '' });

            Lampa.Select.show({
                title: 'Год от',
                items: years,
                onSelect: (it) => {
                    currentFilter.year_from = it.year;
                    if (it.year) {
                        currentFilter.year_to = it.year;
                        selectYearTo();
                        return;
                    }
                    openFilterScreen();
                },
                onBack: openFilterScreen
            });
        }

        function selectYearTo() {
            let years = [];
            let now = new Date().getFullYear();
            let start = currentFilter.year_from ? Number(currentFilter.year_from) : 1960;
            for (let y = now; y >= start; y--) {
                years.push({ title: String(y), year: String(y) });
            }
            years.unshift({ title: 'Любой', year: '' });

            Lampa.Select.show({
                title: 'Год до',
                items: years,
                onSelect: (it) => {
                    currentFilter.year_to = it.year;
                    openFilterScreen();
                },
                onBack: openFilterScreen
            });
        }

        function selectRating() {
            let items = [
                { title: 'Любой', value: '' },
                { title: '4+', value: '4' },
                { title: '5+', value: '5' },
                { title: '6+', value: '6' },
                { title: '7+', value: '7' },
                { title: '8+', value: '8' }
            ];
            Lampa.Select.show({
                title: 'Рейтинг',
                items: items,
                onSelect: (it) => {
                    currentFilter.rating = it.value;
                    openFilterScreen();
                },
                onBack: openFilterScreen
            });
        }

        function selectSort() {
            let items = [
                { title: 'Популярность', value: 'popularity.desc' },
                { title: 'Рейтинг', value: 'vote_average.desc' },
                { title: 'Дата выхода', value: 'first_air_date.desc' },
                { title: 'Количество голосов', value: 'vote_count.desc' },
                { title: 'Дата добавления', value: 'created_at.desc' }
            ];
            Lampa.Select.show({
                title: 'Сортировка',
                items: items,
                onSelect: (it) => {
                    currentFilter.sort = it.value;
                    openFilterScreen();
                },
                onBack: openFilterScreen
            });
        }

        function selectStatus() {
            let items = [
                { title: 'Любой', value: '' },
                { title: 'Вышло', value: 'ended' },
                { title: 'Идёт', value: 'returning' },
                { title: 'Анонс', value: 'planned' }
            ];
            Lampa.Select.show({
                title: 'Статус',
                items: items,
                onSelect: (it) => {
                    currentFilter.status = it.value;
                    openFilterScreen();
                },
                onBack: openFilterScreen
            });
        }

        function applyFilter() {
            activity.filter = Object.assign({}, currentFilter);
            activity.category = currentCategory;
            comp.activity.loader(true);
            scroll.clear();
            last_page = 1;
            finished = false;
            loadPage(1, () => {
                comp.activity.loader(false);
                comp.activity.toggle();
            });
        }

        function buildBaseUrl(page) {
            let lang = 'ja';
            let sort = currentFilter.sort || 'popularity.desc';
            let base_tv = 'discover/tv';
            let base_movie = 'discover/movie';

            function buildParams(base) {
                let p = [];
                p.push('with_original_language=' + lang);
                p.push('page=' + page);
                p.push('sort_by=' + encodeURIComponent(sort));

                if (currentFilter.genre) {
                    p.push('with_genres=' + currentFilter.genre);
                }

                if (currentFilter.year_from) {
                    if (base === 'discover/tv') {
                        p.push('first_air_date.gte=' + currentFilter.year_from + '-01-01');
                    } else {
                        p.push('primary_release_date.gte=' + currentFilter.year_from + '-01-01');
                    }
                }
                if (currentFilter.year_to) {
                    if (base === 'discover/tv') {
                        p.push('first_air_date.lte=' + currentFilter.year_to + '-12-31');
                    } else {
                        p.push('primary_release_date.lte=' + currentFilter.year_to + '-12-31');
                    }
                }
                if (currentFilter.rating) {
                    p.push('vote_average.gte=' + currentFilter.rating);
                }
                if (currentFilter.status && base === 'discover/tv') {
                    if (currentFilter.status === 'ended') {
                        p.push('with_status=0');
                    } else if (currentFilter.status === 'returning') {
                        p.push('with_status=1');
                    } else if (currentFilter.status === 'planned') {
                        p.push('with_status=2');
                    }
                }
                return p.join('&');
            }

            if (currentFilter.type === 'tv') {
                return { tv: base_tv + '?' + buildParams(base_tv), movie: null };
            } else if (currentFilter.type === 'movie') {
                return { tv: null, movie: base_movie + '?' + buildParams(base_movie) };
            } else {
                return {
                    tv: base_tv + '?' + buildParams(base_tv),
                    movie: base_movie + '?' + buildParams(base_movie)
                };
            }
        }

        function loadPage(page, done) {
            if (loading || finished) {
                if (done) done();
                return;
            }
            loading = true;

            let urls = buildBaseUrl(page);
            let promises = [];

            if (urls.tv) {
                promises.push(TMDB.discover(urls.tv));
            } else {
                promises.push(Promise.resolve({ results: [] }));
            }

            if (urls.movie) {
                promises.push(TMDB.discover(urls.movie));
            } else {
                promises.push(Promise.resolve({ results: [] }));
            }

            Promise.all(promises).then((res) => {
                let tv_res = res[0].results || [];
                let mv_res = res[1].results || [];

                tv_res.forEach(i => i.media_type = 'tv');
                mv_res.forEach(i => i.media_type = 'movie');

                let all = tv_res.concat(mv_res);

                if (currentFilter.sort === 'created_at.desc') {
                    all = all.filter(i => i.created_at);
                    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }

                if (category.id === 'top100') {
                    all.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
                }

                if (!all.length) {
                    finished = true;
                }

                renderItems(all);
                last_page = page;
                loading = false;
                if (done) done();
            }).catch(() => {
                loading = false;
                if (done) done();
            });
        }

        function renderItems(items) {
            let cards = Lampa.Template.get('items_line', { title: '' });
            let line = cards.find('.items-line__body');

            items.forEach((item) => {
                let card = Lampa.Template.get('card', item);
                card.addClass('card--anime-rmk');

                card.on('hover:focus', () => {
                    scroll.update(card, true);
                });

                card.on('hover:enter', () => {
                    Lampa.Activity.push({
                        url: '',
                        component: 'full',
                        source: 'tmdb',
                        id: item.id,
                        method: item.media_type === 'movie' ? 'movie' : 'tv'
                    });
                });

                line.append(card);
            });

            scroll.append(cards);
        }

        comp.next = function () {
            if (!loading && !finished) {
                loadPage(last_page + 1);
            }
        };

        comp.render = function () {
            return body;
        };

        comp.destroy = function () {
            scroll.destroy();
            body.remove();
        };
    });

    if (window.appready) createMenuItem();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') createMenuItem();
    });

})();
