(function () {
    'use strict';

    Lampa.Platform.tv();

    function createAnimeTMDBMenu() {
        const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path fill="currentColor" fill-rule="evenodd" d="m368.256 214.573l-102.627 187.35c40.554 71.844 73.647 97.07 138.664 94.503c63.67-2.514 136.974-89.127 95.694-163.243L397.205 150.94c-3.676 12.266-25.16 55.748-28.95 63.634M216.393 440.625C104.077 583.676-57.957 425.793 20.85 302.892c0 0 83.895-147.024 116.521-204.303c25.3-44.418 53.644-72.37 90.497-81.33c44.94-10.926 97.565 12.834 125.62 56.167c19.497 30.113 36.752 57.676 6.343 109.738c-3.613 6.184-136.326 248.402-143.438 257.46m8.014-264.595c-30.696-17.696-30.696-62.177 0-79.873s69.273 4.544 69.273 39.936s-38.578 57.633-69.273 39.937" clip-rule="evenodd"/></svg>`;

        const item = $(`
            <li class="menu__item selector" data-action="anime_tmdb">
                <div class="menu__ico">${icon}</div>
                <div class="menu__text">Аниме Rmk</div>
            </li>
        `);

        item.on('hover:enter', () => openFilters());

        $('.menu .menu__list').eq(0).append(item);
    }

    function openFilters() {
        const years = [];
        for (let y = 2026; y >= 1950; y--) years.push({ title: String(y), year: y });

        const ratings = [
            { title: "6+", value: 6 },
            { title: "7+", value: 7 },
            { title: "8+", value: 8 },
            { title: "8.5+", value: 8.5 },
            { title: "9+", value: 9 }
        ];

        const sortOptions = [
            { title: "Популярность", code: "popularity.desc" },
            { title: "Рейтинг", code: "vote_average.desc" },
            { title: "Дата выхода", code: "first_air_date.desc" },
            { title: "Количество голосов", code: "vote_count.desc" }
        ];

        const statusOptions = [
            { title: "Все", code: "" },
            { title: "Онгоинги", code: "Returning Series" },
            { title: "Завершённые", code: "Ended" }
        ];

        let selected = {
            year_from: null,
            year_to: null,
            rating: null,
            sort: null,
            status: null
        };

        function showMainMenu() {
            Lampa.Select.show({
                title: "Фильтры TMDB",
                items: [
                    { title: "Год от: " + (selected.year_from || "не выбрано"), action: "year_from" },
                    { title: "Год до: " + (selected.year_to || "не выбрано"), action: "year_to" },
                    { title: "Рейтинг: " + (selected.rating || "не выбрано"), action: "rating" },
                    { title: "Сортировка: " + (selected.sort || "не выбрано"), action: "sort" },
                    { title: "Статус: " + (selected.status || "не выбрано"), action: "status" },
                    { title: "Показать результаты", action: "show" }
                ],
                onSelect: (a) => {
                    if (a.action === "year_from") showYearFrom();
                    else if (a.action === "year_to") showYearTo();
                    else if (a.action === "rating") showRating();
                    else if (a.action === "sort") showSort();
                    else if (a.action === "status") showStatus();
                    else if (a.action === "show") runSearch();
                },
                onBack: () => Lampa.Controller.toggle("menu")
            });
        }

        function showYearFrom() {
            Lampa.Select.show({
                title: "Год от",
                items: years,
                onSelect: (a) => {
                    selected.year_from = a.year;
                    showMainMenu();
                },
                onBack: showMainMenu
            });
        }

        function showYearTo() {
            Lampa.Select.show({
                title: "Год до",
                items: years,
                onSelect: (a) => {
                    selected.year_to = a.year;
                    showMainMenu();
                },
                onBack: showMainMenu
            });
        }

        function showRating() {
            Lampa.Select.show({
                title: "Рейтинг",
                items: ratings,
                onSelect: (a) => {
                    selected.rating = a.value;
                    showMainMenu();
                },
                onBack: showMainMenu
            });
        }

        function showSort() {
            Lampa.Select.show({
                title: "Сортировка",
                items: sortOptions,
                onSelect: (a) => {
                    selected.sort = a.code;
                    showMainMenu();
                },
                onBack: showMainMenu
            });
        }

        function showStatus() {
            Lampa.Select.show({
                title: "Статус",
                items: statusOptions,
                onSelect: (a) => {
                    selected.status = a.code;
                    showMainMenu();
                },
                onBack: showMainMenu
            });
        }

        function runSearch() {
            const params = [];

            if (selected.year_from)
                params.push(`first_air_date.gte=${selected.year_from}-01-01`);

            if (selected.year_to)
                params.push(`first_air_date.lte=${selected.year_to}-12-31`);

            if (selected.rating)
                params.push(`vote_average.gte=${selected.rating}`);

            if (selected.status)
                params.push(`with_status=${encodeURIComponent(selected.status)}`);

            const url = "discover/tv?with_original_language=ja&" + params.join("&");

            Lampa.Activity.push({
                url,
                title: "Аниме TMDB",
                component: "category_full",
                source: "tmdb",
                page: 1
            });
        }

        showMainMenu();
    }

    if (window.appready) createAnimeTMDBMenu();
    else Lampa.Listener.follow("app", (e) => {
        if (e.type === "ready") createAnimeTMDBMenu();
    });

})();
