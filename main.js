const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const axios = require("axios");
const pretty = require("pretty");
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
// End Middlewares

// Fetch website and access using jQuery type syntax.
const jQueryWebsite = async url => {
  try {
    const { data } = await axios.get(url);
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

app.get("/pdscourses", async (req, res) => {
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
    // PDSCourses Home Page
    const homePage = await jQueryWebsite("https://www.pdscourses.com/");
    // End

    // PDSCourses categorical pages
    let categoricalPages = [];
    // {
    //   title: "Fitness, Healthy Lifestyle",
    //   link: "https://www.pdscourses.com/fitness-healthy-lifestyle/",
    // }
    homePage("a.fusion-button")
      .filter((index, item) => index>=7&&!homePage(item).text().includes("All"))
      .map((index, ele) => (
        {
          title: homePage(ele).text(),
          link: homePage(ele).attr("href"),
        }
      ))
      .each((index, item) => {
        categoricalPages.push(item);
      });
    // End

    const productPages = await Promise.all(
      // promises that will resolve into a list of categories with
      // their corresponding products.
      categoricalPages.map(async ({title, link}) => {
        // For each category product page, it'll loop through
        // the range to get all the available products.
        let pages = [];
        const range = [...Array(3).keys()];
        const pagePromises = range.map(async num => {
          const pagePromise = new Promise(async (resolve, reject) => {
            try {
              const $ = await jQueryWebsite(`${link}page/${num+1}`);
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
            try {
              const productPage = await jQueryWebsite(pageLink);
              productPage(".post-content > p > a").each((index, item) => {
                if (productPage(item).text().includes("Sales")) {
                  salesPage = productPage(item).attr("href");
                }
              });
              if (productPage(".fusion-text > h3").length) {
                productPage(".fusion-text > h3")
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
              } else if (productPage(".post-content > h3").length) {
                productPage(".post-content > h3")
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
              // document.querySelectorAll(".fusion-text > h3");
              // document.querySelectorAll(".post-content > h3");
              pages.push({
                salesPage,
                description,
                title: page(item).text(),
                downloadLink: {
                  mega: "",
                  koofr: ""
                },
                password: {
                  mega: "",
                  koofr: "",
                },
              });
              return true;
            } catch(err) {
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
});

const lPort = process.env.PORT || 3000;

app.listen(lPort, () => {
  console.log(`listening to port ${lPort}`);
});




























// const productPages = await Promise.all(categoricalPages.map(async ({title, link}) => {


//   arr.filter(page => Boolean(page)&&page!=="error").forEach(page => {
//     page("h2.entry-title > a").each(async (index, item) => {
//       try {
//         console.log("pageLink", pageLink);
//
//
//       } catch(err) {
//         console.log("arr.filter error", err);
//       }
//     });
//   });
//   return {
//     [title]: pages,
//   }
// }));
// console.log(productPages);
