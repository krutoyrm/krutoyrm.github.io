(function () {
    'use strict';

    Lampa.Platform.tv();

    function createAnimeRMKMenu() {
        const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path fill="currentColor" fill-rule="evenodd" d="m368.256 214.573l-102.627 187.35c40.554 71.844 73.647 97.07 138.664 94.503c63.67-2.514 136.974-89.127 95.694-163.243L397.205 150.94c-3.676 12.266-25.16 55.748-28.95 63.634M216.393 440.625C104.077 583.676-57.957 425.793 20.85 302.892c0 0 83.895-147.024 116.521-204.303c25.3-44.418 53.644-72.37 90.497-81.33c44.94-10.926 97.565 12.834 125.62 56.167c19.497 30.113 36.752 57.676 6.343 109.738c-3.613 6.184-136.326 248.402-143.438 257.46m8.014-264.595c-30.696-17.696-30.696-62.177 0-79.873s69.273 4.544 69.273 39.936s-38.578 57.633-69.273 39.937" clip-rule="evenodd"/></svg>`;

        const item = $(`
            <li class="menu__item selector" data-action="anime_rmk">
                <div class="menu__ico">${icon}</div>
                <div class="menu__text">Аниме RMK</div>
            </li>
        `);

        item.on('hover:enter', () => openAnimeRMK());

        $('.menu .menu__list').eq(0).append(item);
    }

    function openAnimeRMK() {
        const genres = [
            { title: "Экшен", tmdb: "28" },
            { title: "Приключения", tmdb: "12" },
            { title: "Комедия", tmdb: "35" },
            { title: "Драма", tmdb: "18" },
            { title: "Фэнтези", tmdb: "14" },
            { title: "Научная фантастика", tmdb: "878" },
            { title: "Детектив", tmdb: "9648" },
            { title: "Романтика", tmdb: "10749" },
            { title: "Анимация", tmdb: "16" },
            { title: "Семейный", tmdb: "10751" },
            { title: "Сёнэн", tmdb: "28,12" },
            { title: "Сэйнэн", tmdb: "18,9648" },
            { title: "Сёдзё", tmdb: "10749,16" },
            { title: "Исекай", tmdb: "14" },
            { title: "Психологическое", tmdb: "18,9648" }
        ];

        const categories = [
            { title: "Популярное", url: "discover/tv?with_original_language=ja&sort_by=popularity.desc" },
            { title: "Топ‑100", url: "discover/tv?with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=200" },
            { title: "Жанры", action: "genres" },
            { title: "Рекомендации TMDB", url: "trending/tv/week?with_original_language=ja" },
            { title: "Подборки", action: "collections" }
        ];

        Lampa.Select.show({
            title: "Аниме RMK",
            items: categories,
            onSelect: (a) => {
                if (a.action === "genres") showGenres(genres);
                else if (a.action === "collections") showCollections();
                else openCatalog(a.title, a.url);
            },
            onBack: () => Lampa.Controller.toggle("menu")
        });
    }

    function showGenres(genres) {
        Lampa.Select.show({
            title: "Жанры",
            items: genres,
            onSelect: (g) => {
                const url = `discover/tv?with_original_language=ja&with_genres=${g.tmdb}`;
                openCatalog(g.title, url);
            },
            onBack: openAnimeRMK
        });
    }

    function showCollections() {
        const items = [
            { title: "Популярное сегодня", url: "trending/tv/day?with_original_language=ja" },
            { title: "Популярное за неделю", url: "trending/tv/week?with_original_language=ja" },
            { title: "Лучшие за всё время", url: "discover/tv?with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=500" },
            { title: "Новые релизы", url: "discover/tv?with_original_language=ja&sort_by=first_air_date.desc" },
            { title: "Аниме 2024–2026", url: "discover/tv?with_original_language=ja&first_air_date.gte=2024-01-01" },
            { title: "Аниме 2010–2020", url: "discover/tv?with_original_language=ja&first_air_date.gte=2010-01-01&first_air_date.lte=2020-12-31" }
        ];

        Lampa.Select.show({
            title: "Подборки",
            items: items,
            onSelect: (c) => openCatalog(c.title, c.url),
            onBack: openAnimeRMK
        });
    }

    function openCatalog(title, url) {
        Lampa.Activity.push({
            url: url,
            title: title,
            component: "category_full",
            source: "tmdb",
            page: 1
        });
    }

    if (window.appready) createAnimeRMKMenu();
    else Lampa.Listener.follow("app", (e) => {
        if (e.type === "ready") createAnimeRMKMenu();
    });

})();
