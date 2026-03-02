(function() {
    'use strict';

    Lampa.Platform.tv();
    
    function initAnime() {
        var icon = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path fill="currentColor" fill-rule="evenodd" d="m368.256 214.573l-102.627 187.35c40.554 71.844 73.647 97.07 138.664 94.503c63.67-2.514 136.974-89.127 95.694-163.243L397.205 150.94c-3.676 12.266-25.16 55.748-28.95 63.634M216.393 440.625C104.077 583.676-57.957 425.793 20.85 302.892c0 0 83.895-147.024 116.521-204.303c25.3-44.418 53.644-72.37 90.497-81.33c44.94-10.926 97.565 12.834 125.62 56.167c19.497 30.113 36.752 57.676 6.343 109.738c-3.613 6.184-136.326 248.402-143.438 257.46m8.014-264.595c-30.696-17.696-30.696-62.177 0-79.873s69.273 4.544 69.273 39.936s-38.578 57.633-69.273 39.937" clip-rule="evenodd"/></svg>';
        
        // Функция создания URL с фильтрами
        function buildUrl(params) {
            var base = 'discover/tv?with_original_language=ja';
            if (params.status) base += '&with_status=' + params.status;
            if (params.year) base += '&first_air_date.gte=' + params.year + '-01-01&first_air_date.lte=' + params.year + '-12-31';
            if (params.season) {
                var dates = getSeasonDates(params.year || new Date().getFullYear(), params.season);
                base += '&first_air_date.gte=' + dates.start + '&first_air_date.lte=' + dates.end;
            }
            if (params.genre) base += '&with_genres=' + params.genre;
            if (params.sort) base += '&sort_by=' + params.sort;
            else base += '&sort_by=popularity.desc';
            return base;
        }
        
        // Получить даты сезона
        function getSeasonDates(year, season) {
            var seasons = {
                'winter': { start: year + '-01-01', end: year + '-03-31' },
                'spring': { start: year + '-04-01', end: year + '-06-30' },
                'summer': { start: year + '-07-01', end: year + '-09-30' },
                'fall': { start: year + '-10-01', end: year + '-12-31' }
            };
            return seasons[season] || seasons['winter'];
        }
        
        // Главное меню
        var menuItem = $('<li class="menu__item selector" data-action="anime_me"><div class="menu__ico">' + icon + '</div><div class="menu__text">anime_me</div></li>');
        
        menuItem.on('hover:enter', function() {
            var items = [
                {
                    title: 'Все аниме',
                    url: buildUrl({}),
                    component: 'category_full'
                },
                {
                    title: 'Сейчас выходит',
                    url: buildUrl({ status: '0' }), // Returning Series
                    component: 'category_full'
                },
                {
                    title: 'Завершенные',
                    url: buildUrl({ status: '3' }), // Ended
                    component: 'category_full'
                },
                {
                    title: 'Анонсированные',
                    url: buildUrl({ status: '1' }), // Planned
                    component: 'category_full'
                },
                {
                    title: 'Зима 2024',
                    url: buildUrl({ year: 2024, season: 'winter' }),
                    component: 'category_full'
                },
                {
                    title: 'Весна 2024',
                    url: buildUrl({ year: 2024, season: 'spring' }),
                    component: 'category_full'
                },
                {
                    title: 'Лето 2024',
                    url: buildUrl({ year: 2024, season: 'summer' }),
                    component: 'category_full'
                },
                {
                    title: 'Осень 2024',
                    url: buildUrl({ year: 2024, season: 'fall' }),
                    component: 'category_full'
                },
                {
                    title: '2024 год',
                    url: buildUrl({ year: 2024 }),
                    component: 'category_full'
                },
                {
                    title: '2023 год',
                    url: buildUrl({ year: 2023 }),
                    component: 'category_full'
                },
                {
                    title: '2022 год',
                    url: buildUrl({ year: 2022 }),
                    component: 'category_full'
                },
                {
                    title: '2021 год',
                    url: buildUrl({ year: 2021 }),
                    component: 'category_full'
                },
                {
                    title: '2020 год',
                    url: buildUrl({ year: 2020 }),
                    component: 'category_full'
                },
                {
                    title: 'Классика (до 2010)',
                    url: 'discover/tv?first_air_date.lte=2010-12-31&with_original_language=ja&sort_by=vote_average.desc',
                    component: 'category_full'
                },
                {
                    title: 'По жанрам →',
                    url: '',
                    component: 'category',
                    categories: [
                        { title: 'Сёнэн', url: buildUrl({ genre: '10759' }), component: 'category_full' },
                        { title: 'Романтика', url: buildUrl({ genre: '10749' }), component: 'category_full' },
                        { title: 'Фантастика', url: buildUrl({ genre: '878' }), component: 'category_full' },
                        { title: 'Фэнтези', url: buildUrl({ genre: '14' }), component: 'category_full' },
                        { title: 'Комедия', url: buildUrl({ genre: '35' }), component: 'category_full' },
                        { title: 'Драма', url: buildUrl({ genre: '18' }), component: 'category_full' },
                        { title: 'Ужасы', url: buildUrl({ genre: '27' }), component: 'category_full' },
                        { title: 'Детектив', url: buildUrl({ genre: '9648' }), component: 'category_full' }
                    ]
                },
                {
                    title: 'Топ по рейтингу',
                    url: buildUrl({ sort: 'vote_average.desc' }),
                    component: 'category_full'
                },
                {
                    title: 'Самые популярные',
                    url: buildUrl({ sort: 'popularity.desc' }),
                    component: 'category_full'
                },
                {
                    title: 'Новинки (по дате)',
                    url: buildUrl({ sort: 'first_air_date.desc' }),
                    component: 'category_full'
                }
            ];
            
            Lampa.Activity.push({
                title: 'anime_me',
                component: 'category',
                categories: items,
                source: 'tmdb',
                card_type: 'true',
                page: 1
            });
        });
        
        $('.menu .menu__list').eq(0).append(menuItem);
    }

    if(window.appready) initAnime();
    else Lampa.Listener.follow('app', function(e) {
        if(e.type == 'ready') initAnime();
    });
})();
