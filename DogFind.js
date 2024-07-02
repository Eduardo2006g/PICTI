//Esse código usa web scraper para buscar links de imagens em sites
const puppeteer = require('puppeteer');

async function scrape() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Configura o cabeçalho para simular uma solicitação de navegador
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0'
  });

  // Navega até a página desejada
  await page.goto('https://pixabay.com/pt/images/search/dogs/', { waitUntil: 'domcontentloaded' });

  // Espera até que a página esteja completamente carregada
  await page.waitForSelector('body');

  // Função para rolar a página até o final
  async function autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 60;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  // Função para criar uma espera explícita
  function waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Rola a página para baixo para carregar todos os elementos
  await autoScroll(page);

  // Espera 2 segundos adicionais para garantir que todos os elementos sejam carregados
  await waitForTimeout(2000);

  // Obtém todos os links de imagens
  const imageLinks = await page.evaluate(() => {
    const imgElements = document.querySelectorAll('img');  // Seleciona todos os elementos <img>
    return Array.from(imgElements)
      .map(img => img.src)  // Extrai o atributo src de cada imagem
      .filter(src => src.endsWith('.jpg'));  // Filtra apenas os links que terminam com .jpg
  });

  // Imprime os links de imagens encontrados
  if (imageLinks.length > 0) {
    console.log('Links de imagens .jpg encontrados:\n', imageLinks.join('\n'));
  } else {
    console.log('Nenhum link de imagem .jpg encontrado.');
  }

  // Fecha o navegador
  await browser.close();
}

// Chama a função para iniciar a raspagem
scrape();
