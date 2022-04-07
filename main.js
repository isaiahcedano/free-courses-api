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
const isPageDownloadable = async (selectorMatch, url) => {
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
      categoricalPages.map(async ({title, link}) => {
        let pages = [];
        const range = [...Array(1).keys()];
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
        const arr = await Promise.all(pagePromises);
        arr.forEach(page => {
          page("h2.entry-title > a").each((index, item) => {
            pages.push({
              title: page(item).text(),
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
            })
          });
        });
        return {
          [title]: pages,
        }
      })
    );

    res.send(categoricalPages);
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
//         const pageLink = page(item).attr("href");
//         console.log("pageLink", pageLink);
//         const productPage = await jQueryWebsite(pageLink);
//         let salesPage = "";
//         productPage(".post-content > p > a").each((index, item) => {
//           if (productPage(item).text().includes("Sales")) {
//             salesPage = productPage(item).attr("href");
//           }
//         });
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
