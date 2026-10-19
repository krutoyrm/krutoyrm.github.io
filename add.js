/* add.js v1.0.0 — install only the four selected Lampa extensions.
 * Original installer code, MIT. Third-party plugins stay at their own URLs.
 * Does not change settings, remove plugins, or reload the application.
 * Existing disabled plugins remain disabled. Installation runs once per profile.
 */
(function () {
    'use strict';
    if (window.__krutoyrm_add_running) return;
    window.__krutoyrm_add_running = true;

    var marker = 'krutoyrm_add_v1';
    var plugins = [
        {url: 'https://krutoyrm.github.io/card_buttons_editor.js', name: 'Редактор кнопок карточки'},
        {url: 'http://showypro.com/m.js', name: 'Showy'},
        {url: 'https://and7ey.github.io/lampa/head_filter.js', name: 'Фильтр верхнего меню'},
        {url: 'http://krutoyrm.github.io/dorama.js', name: 'Дорамы'}
    ];
    var started = false;

    // HTTP and HTTPS variants identify the same extension, but stored URLs
    // are never rewritten (Showy may require HTTP in a native Lampa shell).
    function key(url) {
        return String(url || '').replace(/^https?:\/\//i, '');
    }
    function contains(list, url) {
        return list.some(function (item) {
            return key(typeof item === 'string' ? item : item.url) === key(url);
        });
    }
    function notify(text) {
        if (typeof Lampa !== 'undefined' && Lampa.Noty) Lampa.Noty.show(text);
    }
    function install() {
        if (started) return;
        started = true;
        if (typeof Lampa === 'undefined' || !Lampa.Storage || !Lampa.Plugins ||
            typeof Lampa.Plugins.get !== 'function' || typeof Lampa.Plugins.add !== 'function') {
            notify('add.js: в этой сборке нет API установки плагинов.');
            return;
        }
        try {
            if (Lampa.Storage.get(marker, '') === '1.0.0') return;
            var added = 0;
            plugins.forEach(function (plugin) {
                if (!contains(Lampa.Plugins.get(), plugin.url)) {
                    Lampa.Plugins.add({url: plugin.url, status: 1, name: plugin.name, author: '@krutoyrm'});
                    added++;
                }
            });
            var saved = Lampa.Storage.get('plugins', '[]');
            if (!Array.isArray(saved) || !plugins.every(function (plugin) {
                return contains(saved, plugin.url);
            })) throw new Error('plugin list was not persisted');
            Lampa.Storage.set(marker, '1.0.0');
            notify(added ? 'add.js: добавлено плагинов: ' + added + '. Если нужно, перезапустите Lampa.' :
                'add.js: все четыре плагина уже установлены.');
        } catch (error) {
            console.error('add.js: installation failed', error);
            notify('add.js: установка не завершена. Повторите запуск Lampa.');
        }
    }

    if (window.appready) install();
    else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') install();
        });
    } else notify('add.js: запустите установщик как расширение Lampa.');
}());
