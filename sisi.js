(function() {
    'use strict';

    // Загрузчик sisi.js без проверки origin

    var mirrors = [
        'http://89.110.97.220:10254/sisi.js',
        'https://ab2024.ru/sisi.js',
        'http://139.28.220.127:9118/sisi.js',
        'https://lam.maxvol.pro/sisi.js',
        'http://91.184.245.56:9215/sisi.js',
        'http://185.121.235.124:11176/sisi.js',
        'http://83.217.212.10:12128/sisi.js',
        'http://144.124.225.106:11310/sisi.js'
    ];

    // Выбираем случайное зеркало
    var randomMirror = mirrors[Math.floor(Math.random() * mirrors.length)];

    // Загружаем основной скрипт
    if (window.appready) {
        loadScript();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') loadScript();
        });
    }

    function loadScript() {
        Lampa.Utils.putScriptAsync([randomMirror], function() {});
    }
})();
