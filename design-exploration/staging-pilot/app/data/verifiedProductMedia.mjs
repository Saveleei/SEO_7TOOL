const assetRoot = "/product-media/verified";

function media(id, expectedBrand, expectedSku, expectedTitle, fileName, sourcePage, sourceImage, byteSize, sha256) {
  return Object.freeze({
    id,
    expectedBrand,
    expectedSku,
    expectedTitle,
    image:`${assetRoot}/${fileName}`,
    sourcePage,
    sourceImage,
    byteSize,
    sha256,
  });
}

export const verifiedProductMedia = Object.freeze([
  media("A58185", "Promotech", "UKS-0825-10-20-00-0", "Кромкорез ручной BM-25S", "3d46dcbaefa9c82965b3590bb519af47.jpg", "https://k2tool.ru/catalog/14037-kromkorez-bm-25s", "https://s3.k2tool.ru/images/product/main/j6ietdc7m13jl72u.webp", 59690, "d17e9c05e4793339ffcb527162c1150c0efd049b3b171dbdd6a0ca78ca7a1b38"),
  media("A57252", "RobotMeta", "RM 1470/10 HW", "Робот сварочный RM 1470/10 HW в комплекте с блоком управления RMC 203 PRO", "253d9ae9db25d795c8ea8e011285fba7.webp", "https://k2tool.ru/catalog/14566-svarocnyi-robot-robotmeta-rm-147010-hw", "https://s3.k2tool.ru/images/product/main/35kzrltrbd5ht7xd.webp", 16974, "f59b4f453a0efd1448b5f0eae5e68751eeadc0c2879c17f3ce2d9b2f236c686c"),
  media("A57304", "LIT Machinery", "LIT U2", "Станок заточной универсальный LIT U2", "532f8290443d64893eaf75ff603d36dc.webp", "https://k2tool.ru/catalog/13162-universalnyj-zatochnyj-stanok-lit-u2", "https://s3.k2tool.ru/images/product/main/gjsg1i0lqhyyg13q.webp", 67274, "29edf4e6dfeae0248c5fa91dec85d3b481b52606c706f540309185f5fd51e382"),
  media("A57684", "LIT Machinery", "LIT 6025Q", "Станок заточной универсальный LIT 6025Q", "d8a3a8d91572bf3aa0fcff49a6b46a01.webp", "https://k2tool.ru/catalog/13160-universalnyj-zatochnyj-stanok-lit-6025q", "https://s3.k2tool.ru/images/product/main/cyzbiofzxflpmlop.webp", 52238, "2a5e0e2328eac2be863e8303ba6775356c948d07fc11c6d18c23da62c20fb269"),
  media("A58178", "LIT Machinery", "LIT 600", "Станок заточной универсальный LIT 600", "4de6e89dfdedf55aae9b2b87abcde044.webp", "https://k2tool.ru/catalog/13102-universalnyi-zatocnyi-stanok-lit-machinery-600", "https://s3.k2tool.ru/images/product/main/1hi0hxylzs3oomup.webp", 91104, "4b46a0e469787abebed9d914e071e54dbb0e5fd44dad8a9baa56b5378bae8d19"),
  media("G1", "Karnasch", "11.3000", "Борфрезы твердосплавные форма A (цилиндр с гладким торцом), насечка HP-2, арт. 11.3000", "1ebcbddab97cfcb62a5f228e419e479c.webp", "https://k2tool.ru/catalog/14257-borfreza-karnasch-forma-a-hp2-113000/113000105-12x25x6x70", "https://s3.k2tool.ru/images/product/full/84ggjtjkz360jemh.webp", 5838, "ac7737253380f5ce93eb5443a010bc60026d61695cc44180789a55eb160e4c47"),
  media("G2", "Karnasch", "11.3001", "Борфрезы твердосплавные форма A (цилиндр с гладким торцом), насечка HP-3, арт. 11.3001", "57180eac496eded5bad9bc4de0f53e5e.webp", "https://k2tool.ru/catalog/13627-borfreza-karnasch-forma-a-hp3-113001/113001105-12x25x6x70", "https://s3.k2tool.ru/images/product/full/khsowlctx9o64pe8.webp", 6590, "20e07877a944c52ec3f330019e6a4324a439a50dabf1ee38a1de2f0684be55e6"),
  media("G5", "Karnasch", "11.3004", "Борфрезы твердосплавные форма A (цилиндр с гладким торцом), насечка HP-6, арт. 11.3004", "864fb169118b396c1ff3ea5b13adf7f4.webp", "https://k2tool.ru/catalog/14427-borfreza-karnasch-forma-a-hp6-113004/113004120-16x25x6x70", "https://s3.k2tool.ru/images/product/full/w31z0w0bx5f583lk.webp", 6816, "4b471e82758e765d3079512eb95650717499e905228a6340565b218dc6466055"),
  media("G9", "Karnasch", "11.3011", "Борфрезы твердосплавные форма B (цилиндр с торцевыми зубьями), насечка HP-3, арт. 11.3011", "98cb6c3fcd7f85aaf715968f2f5db46f.webp", "https://k2tool.ru/catalog/13628-borfreza-karnasch-forma-b-hp3-113011/113011075-8x20x6x65", "https://s3.k2tool.ru/images/product/full/681o1v6vya3d699b.webp", 14236, "c54eb0b296b15a7ff9758010074e673d26fb7d42ecd74b5c62e0a66184d6b32d"),
  media("G10", "Karnasch", "11.3012", "Борфрезы твердосплавные форма B (цилиндр с торцевыми зубьями), насечка HP-4, арт. 11.3012", "513d8cc1e3b3e94a753c4a510fabfa9c.webp", "https://k2tool.ru/catalog/13893-borfreza-karnasch-forma-b-hp4-113012/113012040-4x14x6x50", "https://s3.k2tool.ru/images/product/full/1uzkt696epfeeba8.webp", 9228, "42a5df5e582b0b5e022dc0c05ceda937fcea6f64e0eb5ee0f3fd8689224082ca"),
  media("G11", "Karnasch", "11.3013", "Борфрезы твердосплавные форма B (цилиндр с торцевыми зубьями), насечка HP-5, арт. 11.3013", "a27115d68791272f5e410b8d6dcc70ed.webp", "https://k2tool.ru/catalog/14545-borfreza-karnasch-forma-b-hp5-113013/113013050-6x18x6x50", "https://s3.k2tool.ru/images/product/full/l8it4q0r6zpp1bwo.webp", 7544, "6f37732dcfecbed3529d218ce0487ecc515ad496a68bb02822fa944f8fd1e9ae"),
  media("G3", "Karnasch", "11.3002", "Борфрезы твердосплавные форма A (цилиндр с гладким торцом), насечка HP-4, арт. 11.3002", "9c47f31cfbe7f70fc7469ac7a31875a0.webp", "https://k2tool.ru/catalog/13891-borfreza-karnasch-forma-a-hp4-113002/113002065-6x18x6x50", "https://s3.k2tool.ru/images/product/full/ym7xuwzp4e582koz.webp", 8244, "1d5ad2c2b04f514657cd7151e637b5cb2d1d90c9f169ea5f1de1f527ab24f073"),
  media("G6", "Karnasch", "11.3005", "Борфрезы твердосплавные форма A (цилиндр с гладким торцом), насечка HP-7, арт. 11.3005", "29a6753ef8a416f7e2f95aa9f6e1099c.webp", "https://k2tool.ru/catalog/13779-borfreza-karnasch-forma-a-hp7-113005/113005090-10x20x6x65", "https://s3.k2tool.ru/images/product/full/hzcocy8ct7cvo2i2.webp", 4878, "45f805e91f469a1b4fee8bade37b345c97d478d57796c41294d7bfb5de69a35e"),
  media("G8", "Karnasch", "11.3010", "Борфрезы твердосплавные форма B (цилиндр с торцевыми зубьями), насечка HP-2, арт. 11.3010", "1e7804960073712a6e6784af776eabde.webp", "https://k2tool.ru/catalog/14259-borfreza-karnasch-forma-b-hp2-113010/113010100-12x25x6x70", "https://s3.k2tool.ru/images/product/full/ykdxzw5qz7sxde2a.webp", 9068, "8e67a510993099e930d4182b52ec160e0264657e8981d474b2c8ebdc4ce801d5"),
  media("G12", "Karnasch", "11.3014", "Борфрезы твердосплавные форма B (цилиндр с торцевыми зубьями), насечка HP-6, арт. 11.3014", "53788444c370d27393032c20656bf9c4.webp", "https://k2tool.ru/catalog/14429-borfreza-karnasch-forma-b-hp6-113014/113014115-16x25x6x70", "https://s3.k2tool.ru/images/product/full/7rj6ruid96fbh6lg.webp", 8946, "ebd7fd91f43ee4b9ac9bb889b2f6c4d874a53c51b73a0f5cb7d0eace579f1ace"),
  media("A58670", "Heden", "", "Верстак передвижной на колесах WB-6090HM без плиты", "4ca10f5fd5a9d5deba46b73c6da8bb04.webp", "https://k2tool.ru/catalog/11649-verstak-wb-6090hm", "https://s3.k2tool.ru/images/product/main/xcl6rzr7rv0d52to.webp", 23588, "9740a5af5d1a5dd0458ca75a72ae3dba5541d687694c07f71b0886faff50e85f"),
  media("A58806", "Heden", "", "Верстак передвижной на колесах Heden WB-6090HS без плиты", "6c015c4b732524a456e63c7ff665bb13.webp", "https://k2tool.ru/catalog/12137-verstak-wb-6090hs", "https://s3.k2tool.ru/images/product/main/bpiv6c4o38dnb9ox.webp", 27272, "8e81a0c22a6b969b853fecd40b1622ee37c1a00b292d55643a89c10749a3b6d5"),
  media("A8990", "Promotech", "TRZ-0200-04-01-00-2", "Вал распорный к PRO-10 PB, стандартный, арт. TRZ-0200-04-01-00-2", "59611d4607536a38c64f01793d6007a1.webp", "https://k2tool.ru/catalog/14042-val-raspornyi-k-pro-10-pb-standartnyi", "https://s3.k2tool.ru/images/product/main/65eluv644ujccw1m.webp", 10352, "623bb03688982277e3b29c859e9b8a4129fff0d94fdad5cbd2f08cae2844789b"),
  media("G3676", "ONIX", "HSS", "Метчик машинный JIS, HSS/TiN", "3c3192a4cec80a652890e5e67fd44b80.webp", "https://k2tool.ru/catalog/15048-metciki-masinnye-onix-jis-hsstin/m6x1", "https://s3.k2tool.ru/images/product/full/2s6veysqe8okfbyq.webp", 15444, "711b271115b77cfda20681cf689becffc9f0fd8899c0bf73d3569234bf57c582"),
  media("G4430", "ONIX", "HSS-Co", "Метчик машинный JIS, HSS-Co/TiN", "3c3192a4cec80a652890e5e67fd44b80.webp", "https://k2tool.ru/catalog/15049-metciki-masinnye-onix-jis-hss-cotin/m6x1co", "https://s3.k2tool.ru/images/product/full/67t5ygt757d8uwdd.webp", 15444, "711b271115b77cfda20681cf689becffc9f0fd8899c0bf73d3569234bf57c582"),
  media("A26254", "HGTech", "", "Станок лазерной резки SMART3015 T 3 кВт Raycus с модулем для резки труб", "5b97574534c1fc8c691e8d214a19758c.webp", "https://k2tool.ru/catalog/10013-kombinirovannyj-stanok-lazernoj-rezki-hgtech-serii-smart-t", "https://s3.k2tool.ru/images/product/full/kun0dgby0dt5ijom.webp", 33654, "e42c1b2548d82fa201ed21464fd07229217924931679a2ccc9fc39332da9b196"),
]);

const mediaByProductId = new Map(verifiedProductMedia.map((entry) => [entry.id, entry]));

export function applyVerifiedProductMedia(snapshot) {
  return {
    ...snapshot,
    products:snapshot.products.map((product) => {
      const entry = mediaByProductId.get(product.id);
      if (!entry || hasAnyImage(product) || !matchesExpectedIdentity(product, entry)) return product;
      return { ...product, images:[entry.image] };
    }),
  };
}

export function verifiedProductMediaEntry(productId) {
  return mediaByProductId.get(productId);
}

function hasAnyImage(product) {
  return product.images?.some(Boolean) || product.variants?.some((variant) => variant.images?.some(Boolean));
}

function matchesExpectedIdentity(product, entry) {
  return product.brand === entry.expectedBrand
    && product.sku === entry.expectedSku
    && product.title === entry.expectedTitle;
}
