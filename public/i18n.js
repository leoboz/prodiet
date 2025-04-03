// Initialize i18next with browser-compatible setup
i18next
  .use(i18nextBrowserLanguageDetector)
  .use(i18nextHttpBackend)
  .init({
    fallbackLng: 'en',
    debug: true,
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  }, (err, t) => {
    if (err) {
      console.error('i18next initialization error:', err);
      return;
    }
    console.log('i18next initialized successfully');
    console.log('Test translation (welcome):', t('welcome'));
    // Trigger a custom event to notify that i18next is ready
    window.dispatchEvent(new Event('i18nextReady'));
  });

// Ensure language change triggers a full content update
i18next.on('languageChanged', () => {
  console.log('Language changed to:', i18next.language);
  window.dispatchEvent(new Event('languageChanged'));
});