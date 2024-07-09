const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function scrape() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Configura o cabeçalho para simular uma solicitação de navegador
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0'
  });

  const initialUrl = 'https://pixabay.com/pt/images/search/dogs/';
  await page.goto(initialUrl, { waitUntil: 'domcontentloaded' });

  // Verificar se estamos na página correta procurando por um elemento específico
  try {
    await page.waitForSelector('div.verticalMasonry--RoKfF.lg--v7yE8', { timeout: 10000 });
    console.log("Página correta carregada.");
  } catch (error) {
    console.error("Página carregada incorreta, verifique o URL ou a configuração do site.");
    await browser.close();
    return;
  }

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

  // Função para coletar links de imagens na página atual
  async function collectImageLinks(page) {
    await autoScroll(page);
    await waitForTimeout(2000);

    const imageLinks = await page.evaluate(() => {
      const imgElements = document.querySelectorAll('img');  // Seleciona todos os elementos <img>
      return Array.from(imgElements)
        .map(img => img.src)  // Extrai o atributo src de cada imagem
        .filter(src => src.endsWith('.jpg'));  // Filtra apenas os links que terminam com .jpg
    });

    return imageLinks;
  }

  // Função para baixar uma imagem a partir de um link
  async function downloadImage(url, filepath) {
    const writer = fs.createWriteStream(filepath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  let pageNumber = 1;
  let allImageLinks = [];

  while (pageNumber <= 496) {
    console.log(`Coletando imagens da página ${pageNumber}...`);
    const imageLinks = await collectImageLinks(page);
    allImageLinks = allImageLinks.concat(imageLinks);

    if (imageLinks.length > 0) {
      console.log(`Links de imagens .jpg encontrados na página ${pageNumber}:\n`, imageLinks.join('\n'));
      // Baixar todas as imagens da página atual
      for (const link of imageLinks) {
        const filename = path.basename(link);
        const filepath = path.resolve(__dirname, 'images', filename);
        await downloadImage(link, filepath);
        console.log(`Imagem baixada: ${filepath}`);
      }
    } else {
      console.log(`Nenhum link de imagem .jpg encontrado na página ${pageNumber}.`);
    }

    // Incrementa o número da página e vai para a próxima URL
    pageNumber++;
    const nextPageUrl = `https://pixabay.com/pt/images/search/dogs/?pagi=${pageNumber}`;
    console.log(`Indo para a próxima página (${pageNumber})...`);
    try {
      await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      console.log('Erro ao carregar a próxima página. Encerrando a coleta.');
      break;
    }

    // Verifica novamente se estamos na página correta
    try {
      await page.waitForSelector('div.verticalMasonry--RoKfF.lg--v7yE8', { timeout: 10000 });
    } catch (error) {
      console.log('Não foi possível verificar a página correta na próxima página. Encerrando a coleta.');
      break;
    }
  }

  // Imprime todos os links de imagens encontrados
  if (allImageLinks.length > 0) {
    console.log('Todos os links de imagens .jpg encontrados:\n', allImageLinks.join('\n'));
  } else {
    console.log('Nenhum link de imagem .jpg encontrado.');
  }

  // Fecha o navegador
  await browser.close();
}

// Chama a função para iniciar a raspagem
scrape();
