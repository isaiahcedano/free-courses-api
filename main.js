const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const axios = require("axios");
const pretty = require("pretty");
const app = express();
const data = require("./database");
const bcrypt = require("bcrypt");
const knex = require('knex')({
	client: 'pg',
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false
		}
	}
});

// Middlewares
app.use(cors());
app.use(express.json());
// End Middlewares

// Fetch website and access using jQuery type syntax.
const jQueryWebsite = async (url, cookie="") => {
  try {
    const config = {
      url,
      method: 'get',
      headers: {
        'Cookie': cookie,
      }
    };
    const { data } = await axios(config);
    const $ = cheerio.load(data);
    return $;
  } catch(err) {
    console.log("jQueryWebsite", err);
    return null;
  }
}
// End

// Test if page responds with content.
const selectorExists = async (selectorMatch, url) => {
  try {
    const $ = await jQueryWebsite(url);
    return $(selectorMatch).length > 0;
  } catch(err) {
    return false;
  }
}
// End

const pdscoursesLogin = new Promise((resolve, reject) => {
  const FormData = require('form-data');
  const data = new FormData();
  data.append('amember_login', 'shogun_rake');
  data.append('amember_pass', 'darkroses990');

  const config = {
    method: 'post',
    url: 'https://pdscourses.com/amember/login',
    headers: {
      ...data.getHeaders()
    },
    data : data
  };

  axios(config, {
    withCredentials: true,
  })
    .then((response) => {
      // 'Cookie':
      // 'PHPSESSID=hqnt4901gbof08eo53bsnmn9ud;
      // amember_nr=6a9819e7afb81057969d7715403d6e88;
      // amember_rp=d41a83c2006e71c28a1f081f8975761d18ed79a9;
      // amember_ru=shogun_rake',
      resolve({
        cookie: response.headers['set-cookie'].reduce((curr, cook) => {
          return `${curr}${cook}`;
        }, ""),
        url: response.data.url,
      });
    })
    .catch((error) => {
      reject(error);
    });
});

const resetPdscourses = async () => {
  /*
  {
    category: [
      {
        title: "",
        downloadLink: {
          mega: "",
          koofr: ""
        },
        password: {
          mega: "",
          koofr: "",
        },
        salesPage: "",
        description: "",
      }
    ]
  }
  */
  try {
    // Login into pdscourses
    const {url, cookie} = await pdscoursesLogin;

    // PDSCourses Home Page
    // const homePage = await jQueryWebsite("https://www.pdscourses.com/", cookie);
    // End

    // PDSCourses categorical pages
    let categoricalPages = [{
      title: "Self Improvement",
      link: "https://www.pdscourses.com/hypnosis-nlp-psychology/",
    }];

    // homePage("a.fusion-button")
    //   .filter((index, item) => index>=7&&!homePage(item).text().includes("All"))
    //   .map((index, ele) => (
    //     {
    //       title: homePage(ele).text(),
    //       link: homePage(ele).attr("href"),
    //     }
    //   ))
    //   .each((index, item) => {
    //     categoricalPages.push(item);
    //   });
    // End

    const productPages = await Promise.all(
      // promises that will resolve into a list of categories with
      // their corresponding products.
      categoricalPages.map(async ({title, link}) => {
        // For each category product page, it'll loop through
        // the range to get all the available products.
        let pages = [];
        const range = [...Array(11).keys()];
        const pagePromises = range.map(async num => {
          const pagePromise = new Promise(async (resolve, reject) => {
            try {
              const $ = await jQueryWebsite(`${link}page/${num+1}`, cookie);
              resolve($);
            } catch(err) {
              reject("error");
            }
          });
          return await pagePromise;
        });
        // It'll return a list of promises that'll resolve into
        // the category product page number.
        const arr = await Promise.all(pagePromises);
        // arr = category product page number. A list of product pages according
        // to the category.

        // For this category, loop through each product page number, select all the titles,
        // and add them into the pages array.
        await Promise.all(arr.map(async page => {
          return await Promise.all(page("h2.entry-title > a").map(async (index, item) => {
            const pageLink = page(item).attr("href");
            let salesPage = "";
            let description = "";
            const megaLink = [];
            const koofrLink = [];
            const mediaLink = [];
            const megaPasswords = [];
            const mediaPasswords = [];
            const koofrPasswords = [];
            const passwords = [];
            try {
              const productPage = await jQueryWebsite(pageLink, cookie);

              // Set product salespage
              productPage("a").each((index, item) => {
                if (productPage(item).text().includes("Sales")) {
                  salesPage = productPage(item).attr("href");
                }
              });
              // End

              // Set product description
              if (productPage("h3").length) {
                productPage("h3")
                .each((index, item) => {
                  if (
                    !productPage(item).text().includes("SIZE:") &&
                    !productPage(item).text().includes("Size:") &&
                    productPage(item).text() !== "DOWNLOAD" &&
                    productPage(item).text() !== "Download"
                  ) {
                    description = `${description ? description + " " : ''}${productPage(item).text()}`
                  }
                });
              }
              // End

              // Set product link
              if (productPage("a").length) {
                productPage("a").each((index, ele) => {
                  if (productPage(ele).attr("href")
                      .includes("mega.nz")) {
                    megaLink.push(productPage(ele).attr("href"));
                  } else if (productPage(ele).attr("href").includes("k00.fr")) {
                    koofrLink.push(productPage(ele).attr("href"));
                  } else if (productPage(ele).attr("href").includes("mediafire.com")) {
                    mediaLink.push(productPage(ele).attr("href"));
                  }
                });
              }
              // End

              // Set product password
              if (productPage("p, h2, h3, h4, h5, h6, span").length) {
                productPage("p, h2, h3, h4, h5, h6, span").each((index, ele) => {
                  if (productPage(ele).text().includes("Password")) {
                    passwords.push(productPage(ele).text());
                  }
                })
              }

              pages.push({
                salesPage,
                description,
                title: page(item).text(),
                downloadLink: {
                  mega: megaLink,
                  koofr: koofrLink,
                  media: mediaLink,
                },
                password: passwords,
              });
              return true;
            } catch(err) {
              console.log(err);
              return false;
            }
          }));
        }));

        // return a category as key and pages as value.
        return {
          [title]: pages,
        }
      })
    );

    res.send(productPages.reduce((curr, item) => {
      const course = Object.entries(item)[0];
      const category = course[0];
      const products = course[1];
      return {
        ...curr,
        [category]: products,
      }
    }, {}));
  } catch(err) {
    console.log(err);
    res.send("failed");
  }
}

app.get("/products", async (req, res) => {
  const products = Object.entries(data).reduce((curr, [category, courses]) => {
    return {
      ...curr,
      [category]: courses.reduce((curr, {title, salesPage, description, imgSrc}) => {
        return [
          ...curr,
          {
            title,
            imgSrc,
            salesPage,
            description,
            price: '2.99',
          }
        ]
      }, [])
    }
  }, {})
  res.json(products);
});

const getInfo = (db, item) => {

  let productInfo = Object.entries(db).reduce((curr, [category, courses]) => [
    ...curr,
    courses.filter((product) => {
      if (item===product.title) {
        return {
          category,
          ...product,
        }
      }
    })[0],
  ], []).filter(item => typeof(item)!=="undefined");

  if (typeof(productInfo) === 'undefined') {
    productInfo = {
      title: item,
      price: 0,
      description: "",
      salesPage: "",
      category: "",
    }
  }
  return productInfo;
}

app.post("/purchase", async (req, res) => {
  const products = Object.entries(data).reduce((curr, [category, courses]) => {
    return {
      ...curr,
      [category]: courses.reduce((curr, {title, salesPage, description, imgSrc}) => {
        return [
          ...curr,
          {
            title,
            imgSrc,
            salesPage,
            description,
            price: '2.99',
          }
        ]
      }, [])
    }
  }, {})

  const axiosConfig = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Ri2aTRa91ubV5RYK6XjYgQ'
    }
  }
  const {cart} = req.body;
  const validCart = cart.filter(({quantity}) => quantity === '1');
  const totalAmount = validCart.reduce((curr, {item, quantity}) => {
    const productInfo = getInfo(products, item)[0];
    const digit = curr + (productInfo.price*quantity);
    return Number((Math.round(digit*100)/100).toFixed(2));
  }, 0);
  const btcResponse = await axios.post("https://www.poof.io/api/v1/create_invoice", {
    amount: totalAmount.toString(),
    crypto: "BTC",
    currency: "USD",
    redirect: "https://coursehome.netlify.app/home"
  }, axiosConfig);
  res.json(btcResponse.data);
});

app.post("/register", async (req, res) => {
  const {name, email, pass} = req.body;
  const saltRounds = 12;
  try {
    bcrypt.genSalt(saltRounds, (err, salt) => {
        bcrypt.hash(pass, salt, async (err, hash) => {
          try {
            await knex.transaction(trx => {
              trx("users").insert({
                name,
                email,
                pass: hash,
                registration_date: new Date(),
              }).then(trx.commit).catch(trx.rollback);
            });
            res.json(true);
          } catch(err) {
            res.json(false);
          }
      });
    });
  } catch(err) {
    res.json(false);
  }
});

app.post("/login", async (req, res) => {
  const {email, pass} = req.body;
  let reqEmail = email;
  try {
    const response = await knex.select('email', 'pass').from('users');
    const dbUser = response.filter(({email}) => email===reqEmail)[0];
    if (!dbUser) {
      throw Error();
    }
    bcrypt.compare(pass, dbUser.pass, (err, result) => {
      res.json(result);
    });
  } catch(err) {
    res.json(false);
  }
});

// app.get("/pdscourses", async (req, res) => {
//   /*
//   {
//     category: [
//       {
//         title: "",
//         downloadLink: {
//           mega: "",
//           koofr: ""
//         },
//         password: {
//           mega: "",
//           koofr: "",
//         },
//         salesPage: "",
//         description: "",
//       }
//     ]
//   }
//   */
//   try {
//     // Login into pdscourses
//     const {url, cookie} = await pdscoursesLogin;
//
//     // PDSCourses Home Page
//     // const homePage = await jQueryWebsite("https://www.pdscourses.com/", cookie);
//     // End
//
//     // PDSCourses categorical pages
//     let categoricalPages = [{
//       title: "Self Improvement",
//       link: "https://www.pdscourses.com/hypnosis-nlp-psychology/",
//       rangeCategory: 11
//     }];
//
//     /*
//       ,
//       ,
//       ,
//     */
//
//     // homePage("a.fusion-button")
//     //   .filter((index, item) => index>=7&&!homePage(item).text().includes("All"))
//     //   .map((index, ele) => (
//     //     {
//     //       title: homePage(ele).text(),
//     //       link: homePage(ele).attr("href"),
//     //     }
//     //   ))
//     //   .each((index, item) => {
//     //     categoricalPages.push(item);
//     //   });
//     // End
//
//     const productPages = await Promise.all(
//       // promises that will resolve into a list of categories with
//       // their corresponding products.
//       categoricalPages.map(async ({title, link, rangeCategory}) => {
//         // For each category product page, it'll loop through
//         // the range to get all the available products.
//         let pages = [];
//         const range = [...Array(rangeCategory).keys()];
//         const pagePromises = range.map(async num => {
//           const pagePromise = new Promise(async (resolve, reject) => {
//             try {
//               const $ = await jQueryWebsite(`${link}page/${num+1}`, cookie);
//               resolve($);
//             } catch(err) {
//               reject("error");
//             }
//           });
//           return await pagePromise;
//         });
//         // It'll return a list of promises that'll resolve into
//         // the category product page number.
//         const arr = await Promise.all(pagePromises);
//         // arr = category product page number. A list of product pages according
//         // to the category.
//
//         // For this category, loop through each product page number, select all the titles,
//         // and add them into the pages array.
//         await Promise.all(arr.map(async page => {
//           return await Promise.all(page("h2.entry-title > a").map(async (index, item) => {
//             const pageLink = page(item).attr("href");
//             let salesPage = "";
//             let description = "";
//             let imgSrc = "";
//             const megaLink = [];
//             const koofrLink = [];
//             const mediaLink = [];
//             const megaPasswords = [];
//             const mediaPasswords = [];
//             const koofrPasswords = [];
//             const passwords = [];
//             try {
//               const productPage = await jQueryWebsite(pageLink, cookie);
//
//               // Set product salespage
//               productPage("a").each((index, item) => {
//                 if (productPage(item).text().includes("Sales")) {
//                   salesPage = productPage(item).attr("href");
//                 }
//               });
//               // End
//
//               // Set product description
//               if (productPage("h3").length) {
//                 productPage("h3")
//                 .each((index, item) => {
//                   if (
//                     !productPage(item).text().includes("SIZE:") &&
//                     !productPage(item).text().includes("Size:") &&
//                     productPage(item).text() !== "DOWNLOAD" &&
//                     productPage(item).text() !== "Download"
//                   ) {
//                     description = `${description ? description + " " : ''}${productPage(item).text()}`
//                   }
//                 });
//               }
//               // End
//
//               // Set product link
//               if (productPage("a").length) {
//                 productPage("a").each((index, ele) => {
//                   if (productPage(ele).attr("href")
//                       .includes("mega.nz")) {
//                     megaLink.push(productPage(ele).attr("href"));
//                   } else if (productPage(ele).attr("href").includes("k00.fr")) {
//                     koofrLink.push(productPage(ele).attr("href"));
//                   } else if (productPage(ele).attr("href").includes("mediafire.com")) {
//                     mediaLink.push(productPage(ele).attr("href"));
//                   }
//                 });
//               }
//               // End
//
//               // Set product password
//               if (productPage("p, h2, h3, h4, h5, h6, span").length) {
//                 productPage("p, h2, h3, h4, h5, h6, span").each((index, ele) => {
//                   if (productPage(ele).text().includes("Password")) {
//                     passwords.push(productPage(ele).text());
//                   }
//                 })
//               }
//
//               // Set image source
//               if (productPage("img").length) {
//                 productPage("img").each((index, ele) => {
//                   if (index === 1) {
//                     imgSrc = productPage(ele).attr("src");
//                   }
//                 })
//
//               }
//
//               pages.push({
//                 salesPage,
//                 description,
//                 imgSrc,
//
//                 title: page(item).text(),
//                 downloadLink: {
//                   mega: megaLink,
//                   koofr: koofrLink,
//                   media: mediaLink,
//                 },
//                 password: passwords,
//               });
//               return true;
//             } catch(err) {
//               console.log(err);
//               return false;
//             }
//           }));
//         }));
//
//         // return a category as key and pages as value.
//         return {
//           [title]: pages,
//         }
//       })
//     );
//
//     res.send(productPages.reduce((curr, item) => {
//       const course = Object.entries(item)[0];
//       const category = course[0];
//       const products = course[1];
//       return {
//         ...curr,
//         [category]: products,
//       }
//     }, {}));
//   } catch(err) {
//     console.log(err);
//     res.send("failed");
//   }
// })

const lPort = process.env.PORT || 3001;

app.listen(lPort, () => {
  console.log(`listening to port ${lPort}`);
});
