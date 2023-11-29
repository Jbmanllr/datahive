// equipboard.js (handlers)
import { RequestQueue, KeyValueStore, Dataset } from "crawlee";

export const EXTRACT_FREQUENCY_MINUTES = 14400;
const useLastRunEndDate = false;

const LABEL_NAMES = {
  HOMEPAGE: "HOMEPAGE",
  DETAIL_PROS: "DETAILPROS",
  DETAIL_PRODUCTS: "DETAILPRODUCTS",
  DETAIL_BRANDS: "DETAILBRANDS",
  DETAIL_BANDS: "DETAILBANDS",
  DETAIL_OCCURRENCES: "DETAILOCCURRENCES",
  PICTURES_PROS: "PICTURESPROS",
  PICTURES_PRODUCTS: "PICTURESPRODUCTS",
  PICTURES_BANDS: "PICTURESBANDS",
  PICTURES_BRANDS: "PICTURESBRANDS",
  PICTURES_OCCURRENCES: "PICTURESOCCURRENCES",
  LISTING_OCCURRENCES: "LISTINGOCCURRENCES",
};

export const handlers = {
  PRE_NAVIGATION_PREPARATION: async (context, databee, apiRequest) => {
    const { page, request, log, enqueueLinks, pushData } = context;
    // Intercept network requests
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();

      // List of resource types to block
      const blockedTypes = ["video", "image", "media", "font", "stylesheet"];

      if (blockedTypes.includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    await page.waitForTimeout(1000);
    await removeOverlays(page);
  },
  LOGIN: async (context, databee, apiRequest) => {
    const { email, username, password } = databee.project.data;
    if ((email || username) && password) {
    } else {
      console.log(
        "Invalid input: Both mail (or username) and password are required."
      );
      return;
    }
    const { page, request, log, enqueueLinks, pushData } = context;
    // Check if we have stored cookies
    const storedCookies = await KeyValueStore.getValue("SESSION_COOKIES");
    if (storedCookies) {
      await page.context().addCookies(storedCookies);
    } else {
      // If no stored cookies, navigate to the login page and perform login
      await page.goto("https://equipboard.com/login");

      await page.fill("#user_email", email);
      await page.fill("#user_password", password);
      await page.waitForTimeout(1000);
      await page.click('input[type="submit"]');

      // Wait for login to complete (e.g., by waiting for a specific element that indicates successful login)
      await page.waitForSelector('a.dropdown-item[href="/logout"]');

      // Store the session cookies for future use
      const cookies = await page.context().cookies();
      await KeyValueStore.setValue("SESSION_COOKIES", cookies);
    }
  },
  DEFAULT: async (context, databee, apiRequest) => {
    console.log("RUNNING DEFAULT HANDLER");
  },
  FAILED: async ({ request }, context, databee, apiRequest) => {
    // This function is called when the crawling of a request failed too many times
    console.log("RUNNING FAILED HANDLER");
    await Dataset.pushData({
      url: request.url,
      succeeded: false,
      errors: request.errorMessages,
    });
  },
  async failedRequestHandler({ request }, context, databee, apiRequest) {
    // This function is called when the crawling of a request failed too many times
    console.log("RUNNING FAILED HANDLER");
    await Dataset.pushData({
      url: request.url,
      succeeded: false,
      errors: request.errorMessages,
    });
  },
  HOMEPAGE: async (context, databee, apiRequest) => {
    const { page, request, log, enqueueLinks, pushData } = context;
    // Navigate to the desired URL that lists the gear
    await page.goto("https://equipboard.com/?filter=gear");
    await page.waitForTimeout(1000);

    console.log("DATABEE IN HOMEPAGE", databee);

    const latest_run = databee.project.data.databee_runs[0];

    // Calculate the date threshold. Items older than this date will not be processed
    let thresholdDate;
    if (useLastRunEndDate && latest_run && latest_run.length > 0) {
      thresholdDate = new Date(latest_run.date_end);
    } else {
      thresholdDate = new Date(
        Date.now() - EXTRACT_FREQUENCY_MINUTES * 60 * 1000
      );
    }

    console.log("Threshold date for item processing:", thresholdDate);

    // Initialize a set to keep track of processed items to avoid duplicates
    const processedItems = new Set();
    // Initialize a variable to control the scraping loop
    let continueScraping = true;

    while (continueScraping) {
      // Retrieve all the gear cards from the current page
      const cards = await page.$$("div.eb-home-feed__container div.card");

      for (const card of cards) {
        // Extract the links to the pro, item, and occurrence details
        const [proLink, itemLink, occurrenceLink] = await Promise.all([
          card.$eval("h3[class='h5 mt-0 mb-0'] a", (el) =>
            el.getAttribute("href")
          ),
          card.$eval("h3[class='h5'] a", (el) => el.getAttribute("href")),
          card.$eval("a.text-eb-orange.eb-home-feed__read-more-link", (el) =>
            el.getAttribute("href")
          ),
        ]);

        // Generate a unique identifier for the current item
        const uniqueId = proLink + itemLink + occurrenceLink;
        //console.log("Unique ID for the item:", uniqueId);

        // Check if the item has already been processed
        if (processedItems.has(uniqueId)) {
          console.log("Item has already been processed. Skipping...");
          continue;
        }

        // Extract the published date text and convert it to a date object
        const timeText = await card.$eval(
          "small.font-weight-normal.text-muted",
          (el) => el.textContent
        );
        const approxDatePublished = await getApproxPublishDate(timeText);
        console.log("Approximate date published:", approxDatePublished);

        console.log(
          "REQUETS QUEUE NAME",
          generateRequestQueueName(
            databee.project.data.id,
            databee.data.id,
            "label"
          )
        );
        if (approxDatePublished >= thresholdDate) {
          // Enqueue details for further processing
          const enqueueDetails = async (label, url) => {
            try {
              const requestQueue = await RequestQueue.open(
                generateRequestQueueName(
                  databee.project.data.id,
                  databee.data.id,
                  label
                )
              );
              await requestQueue.addRequest({
                url: prepareLink(url),
                label,
                userData: {
                  pro: proLink,
                  approx_date_published: approxDatePublished,
                  run_id: databee.data.id,
                },
              });
              //console.log(`Details enqueued for ${label}`);
            } catch (err) {
              console.error("Error enqueuing details:", err.message);
            }
          };

          // Enqueue details for occurrence, pro, and product
          await Promise.all([
            enqueueDetails(LABEL_NAMES.DETAIL_OCCURRENCES, occurrenceLink),
            enqueueDetails(LABEL_NAMES.DETAIL_PROS, proLink),
            enqueueDetails(LABEL_NAMES.DETAIL_PRODUCTS, itemLink),
          ]);

          // Add the unique identifier to the set of processed items
          processedItems.add(uniqueId);
          console.log("Item processed and added to the set of processed items");
        } else {
          continueScraping = false;
          break;
        }
      }

      if (continueScraping) {
        // Click on the next page button and wait for the page to load
        await page.click('a.btn.btn-dark.btn-block[rel="next"]');
        await page.waitForFunction(
          () => {
            return (
              document.querySelectorAll("div.eb-home-feed__container div.card")
                .length > 0
            );
          },
          { timeout: 10000 }
        );
      }
    }
  },
  DETAILOCCURRENCES: async (context, databee, apiRequest) => {
    const { page, request, log, enqueueLinks, pushData } = context;
    //await removeOverlays(page);
    //const { pathname: path } = new URL(request.loadedUrl);
    const { pro: proPath } = request.userData;

    const submissionId = extractSubmissionId(request.loadedUrl);
    if (!submissionId) {
      console.log("Failed to extract occurrence ID from:", request.loadedUrl);
      return;
    }

    const element = await page.$(
      `div.card.mb-3.eb-custom-card.smaller-text[data-submission-id="${submissionId}"]`
    );
    if (!element) return;

    const maxRetries = 3;
    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
      try {
        await element.waitForSelector("#loading", {
          state: "detached",
          timeout: 6000,
        });

        const data = await extractData(page, submissionId);

        await handleImage(data, submissionId, databee);
        const preparedData = prepareDataForPush(
          data,
          request,
          proPath,
          submissionId,
          databee
        );
        if (true) {
          const dataset = await Dataset.open(
            `${databee.project.data.id}__${databee.data.id}`
          );
          await dataset.pushData(preparedData);
        }
        if (true) {
          await apiRequest({
            method: "POST",
            collection: databee.config.raw_data_collection,
            data: {
              data: preparedData,
              entity_type: request.label,
              source: databee.project.data.key,
              project_id: databee.project.data.id,
              run_id: databee.data.id,
              run_session_id: databee.runSession.data.id,
              label: "updater",
            },
            run: databee,
          });
        }
        console.log(`Submission #${submissionId} extracted successfully`);

        return;
      } catch (error) {
        console.log(
          `Retry ${retryCount + 1} for submission ID ${submissionId}:`,
          error.message
        );
        if (retryCount === maxRetries - 1) {
          console.log(
            `Failed to process element with submission ID ${submissionId} after ${maxRetries} retries.`
          );
        }
      }
    }
  },
  DETAILPROS: async (context, databee, apiRequest) => {
    const { request, log, enqueueLinks, pushData, $ } = context;
    const path = new URL(request.loadedUrl).pathname;

    const meta_title_element = $("title");
    const meta_description_element = $('meta[name="description"]');
    const meta_robot_element = $('meta[name="robots"]');
    const name_element = $("div.eb-artist__header-info div div div h1.h3");
    const image_rsrc_element = $("div.hero-img img");
    const image_alt_element = $("div.hero-img img");
    const nb_occurrences_element = $("div#stick-here h2:first-child sup");
    const followers_count_element = $("#show-followers-modal");
    const contributors_count_element = $('a[data-target="#contributorsModal"]');
    const social_links_element = $(".eb-artist__header-social-icons.d-flex a");
    const roles_element = $(".eb-artist__tags");
    const genres_element = $(".eb-artist__tags");
    const groups_element = $(".eb-artist__tags");

    let nb_occurrences = 0;
    let img_src = null;
    let followersCount = 0;
    let contributorsCount = 0;
    const errors = [];
    const socialData = [];
    const roles = [];
    const genres = [];
    const groups = [];

    // GET NB OF OCCURRENCES

    try {
      const nb_occ_text = nb_occurrences_element.text();
      if (nb_occ_text) {
        nb_occurrences = parseInt(nb_occ_text, 10);
      }
    } catch (err) {
      console.error("Error", err.message);
      errors.push({ nb_occurrences: err.message });
    }

    // ENQUEU LINKS TO ELIGIBLE PRO/OCCURRENCE LISTING
    if (nb_occurrences > 0) {
      const requestQueueListingOccurrences = await RequestQueue.open(
        generateRequestQueueName(
          databee.project.data.id,
          databee.data.id,
          LABEL_NAMES.LISTING_OCCURRENCES
        )
      );

      const occ_list_link = request.loadedUrl.includes("?")
        ? `${request.loadedUrl}&hide_incorrect_submissions=false`
        : `${request.loadedUrl}?hide_incorrect_submissions=false`;

      await enqueueLinks({
        urls: [occ_list_link],
        label: LABEL_NAMES.LISTING_OCCURRENCES,
        requestQueue: requestQueueListingOccurrences,
      });
    }

    // GET NB FOLLOWERS
    try {
      const followersText = followers_count_element.text();
      followersCount = parseInt(followersText, 10);
    } catch (error) {
      console.log("Error", error.message);
      errors.push({ followers_count: error.message });
    }

    // GET NB CONTRIBUTORS
    try {
      const contributorsText = contributors_count_element.text();
      contributorsCount = parseInt(contributorsText, 10);
    } catch (error) {
      console.log("Error", error.message);
      errors.push({ contributors_count: error.message });
    }

    // EXTRACT SOCIAL LINKS
    if (social_links_element && social_links_element.length > 0) {
      try {
        social_links_element.each((i, item) => {
          const title = $(item).attr("alt");
          const href = $(item).attr("href");

          if (title && href) {
            socialData.push({
              [title]: href,
            });
          }
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ social_links: err.message });
      }
    }

    // EXTRACT ROLES
    if (roles_element && roles_element.length > 0) {
      try {
        roles_element
          .filter((i, el) => {
            return (
              $(el).find(".eb-artist__tag-label").text()?.trim() === "Roles"
            );
          })
          .find("a")
          .each((i, link) => {
            roles.push({
              name: $(link).text()?.trim(),
              url: $(link).attr("href"),
            });
          });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ roles: err.message });
      }
    }

    // EXTRACT GENRES
    if (genres_element && genres_element.length > 0) {
      try {
        genres_element
          .filter((i, el) => {
            return (
              $(el).find(".eb-artist__tag-label").text()?.trim() === "Genres"
            );
          })
          .find("a")
          .each((i, link) => {
            genres.push({
              name: $(link).text()?.trim(),
              url: $(link).attr("href"),
            });
          });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ genres: err.message });
      }
    }

    // EXTRACT GROUPS
    if (groups_element && groups_element.length > 0) {
      try {
        groups_element
          .filter((i, el) => {
            return (
              $(el).find(".eb-artist__tag-label").text()?.trim() === "Groups"
            );
          })
          .find("a")
          .each((i, link) => {
            groups.push({
              name: $(link).text()?.trim(),
              url: $(link).attr("href"),
            });
          });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ groups: err.message });
      }
    }

    // ENQUEU LINKS TO BANDS DETAILS
    if (groups.length > 0) {
      try {
        const urls = groups.map((i) => databee.project.data.base_url + i.url);

        const bandRequestQueue = await RequestQueue.open(
          generateRequestQueueName(
            databee.project.data.id,
            databee.data.id,
            LABEL_NAMES.DETAIL_BANDS
          )
        );

        await enqueueLinks({
          urls: urls,
          label: LABEL_NAMES.DETAIL_BANDS,
          requestQueue: bandRequestQueue,
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ push_band_links: err.message });
      }
    }

    // GET PICTURE SRC
    try {
      const img_el = $("div.media img.rounded-circle").attr("data-original");
      if (!img_el.includes("default-user-pic")) {
        img_src = img_el;
      }
    } catch (err) {
      console.error("Error", err.message);
      errors.push({ img_src: err.message });
    }

    //
    // ENQUEUE LINKS TO PRO PICTURES
    //

    // "default-user-pic"

    const substrings = ["https://", "http://"];
    const containsSubstring = substrings.some((sub) => img_src?.includes(sub));

    if (img_src && containsSubstring) {
      try {
        const proPictureRequestQueue = await RequestQueue.open(
          generateRequestQueueName(
            databee.project.data.id,
            databee.data.id,
            LABEL_NAMES.PICTURES_PROS
          )
        );

        await proPictureRequestQueue.addRequest({
          url: img_src,
          label: LABEL_NAMES.PICTURES_PROS,
          userData: { related_entity: path },
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ enqueue_pro_pictures: err.message });
      }
    }

    const preparedData = {
      url: request.loadedUrl,
      path: path,
      label: request.label,
      meta_title: meta_title_element.text(),
      meta_description: meta_description_element.attr("content"),
      meta_robot: meta_robot_element.attr("content"),
      name: name_element.text(),
      image_src: img_src,
      image_rsrc: image_rsrc_element.attr("data-rsrc"),
      image_alt: image_alt_element.attr("alt"),
      nb_occurrences: nb_occurrences,
      followersCount: followersCount,
      contributorsCount: contributorsCount,
      roles: roles,
      genres: genres,
      groups: groups,
      social_links: socialData,
      crawl_errors: errors,
      run_id: databee.data.id,
    };
    if (true) {
      const dataset = await Dataset.open(
        `${databee.project.data.id}__${databee.data.id}`
      );
      await dataset.pushData(preparedData);
    }
    if (true) {
      await apiRequest({
        method: "POST",
        collection: databee.config.raw_data_collection,
        data: {
          data: preparedData,
          entity_type: request.label,
          source: databee.project.data.key,
          project_id: databee.project.data.id,
          run_id: databee.data.id,
          run_session_id: databee.runSession.data.id,
          label: "updater",
        },
        run: databee,
      });
    }
  },
  DETAILPRODUCTS: async (context, databee, apiRequest) => {
    const { request, log, enqueueLinks, pushData, $ } = context;
    const path = new URL(request.loadedUrl).pathname;
    const errors = [];
    const report = [];

    const meta_title_element = $("title");
    const meta_description_element = $('meta[name="description"]');
    const meta_robot_element = $('meta[name="robots"]');
    const description_element = $(".tab-pane#nav-details .container.py-5 p");
    const brand_url_element = $("h1.d-none.d-md-block.mb-4.mt-1 a");
    const eb_score_element = $("div.eb-item__consensus div span.score");
    const consensus_element = $(
      'div.eb-item__consensus div[class="d-flex flex-column"] small:not([class])'
    );

    // PRODUCT NAME

    let name;
    const nameEl = $("h1.d-none.d-md-block.mb-4.mt-1");

    if (nameEl && nameEl.length > 0) {
      try {
        name = nameEl
          .contents()
          .filter(function () {
            return this.type === "text";
          })
          .text()
          ?.trim();
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ name: err.message });
      }
    } else {
      errors.push({ name: "Could not find product name" });
    }

    //
    // CATEGORIES
    //

    let categories = [];
    const categoriesEl = $('script[type="application/ld+json"]');

    if (categoriesEl && categoriesEl.length > 0) {
      let jsonData;
      categoriesEl.each(function () {
        try {
          jsonData = JSON.parse($(this).html().trim());

          // Check if the @type is "BreadcrumbList"
          if (jsonData["@type"] === "BreadcrumbList") {
            jsonData["itemListElement"].forEach((element) => {
              if (element.item && element.item.name && element.item["@id"]) {
                const url = new URL(element.item["@id"]);
                const pathname = url.pathname;

                const category = {
                  name: element.item.name,
                  url: pathname,
                };
                categories.push(category);
              }
            });
          }
        } catch (err) {
          //console.error(
          //  `Error parsing JSON-LD script tag for ${jsonData["@type"]}: `,
          //  err.message
          //);
          errors.push({
            categories: `${err.message} for ${jsonData["@type"]}`,
          });
        }
      });
    } else {
      errors.push({ categories: "Could not find any JSON Element" });
    }

    let last_category = request.userData.category;

    if (!categories || categories.length === 0) {
      if (!last_category) {
        errors.push({ categories: "Could not find any category" });
      }
    }

    // BUY OPTIONS LINKS
    const links = [];
    const linksEl = $(
      'div[class="d-none d-md-flex eb-item__buy-options align-items-center text-center mb-3"] a'
    );
    if (linksEl && linksEl.length > 0) {
      linksEl.each(function () {
        links.push($(this).attr("href"));
      });
    }

    // EXTRACT THE RATING SCORE
    let ratingScore;
    const ratingScoreEl = $(".eb-item__average_rating");

    if (ratingScoreEl && ratingScoreEl.length > 0) {
      try {
        ratingScore = parseFloat(ratingScoreEl.text()?.trim());
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ rating: err.message });
      }
    } else {
      errors.push({ rating: "Could not find rating score element" });
    }

    // EXTRACT THE NUMBER OF RATINGS
    let numOfRatings;
    const numOfRatingsEl = $('p:contains("Ratings")');

    if (numOfRatingsEl && numOfRatingsEl.length > 0) {
      try {
        const numOfRatingsMatch = numOfRatingsEl?.text().match(/(\d+) Ratings/);
        numOfRatings = numOfRatingsMatch
          ? parseInt(numOfRatingsMatch[1], 10)
          : null;
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ nb_ratings: err.message });
      }
    } else {
      errors.push({ nb_ratings: "Could not find number of ratings element" });
    }

    // REVIEWS FROM HTML
    const reviews = [];
    const commentEl = $(".eb-comment");

    if (commentEl && commentEl.length > 0) {
      $(commentEl).each((i, element) => {
        try {
          const review = {};

          review.id = $(element).data("id");
          review.commenterName = $(element)
            .find(".eb-comment__username .username")
            .text()
            ?.trim();
          review.commenterProfileUrl = $(element)
            .find(".eb-comment__username a")
            .attr("href")
            ?.trim();
          review.h6 = $(element).find("h6").text()?.trim();
          review.commentContent = $(element).find(".w-75").text()?.trim();
          review.upvoteCount =
            parseInt($(element).find(".upvote-count").text()?.trim(), 10) || 0;
          review.rating = $(element).find(".fas.fa-star")?.length;
          reviews.push(review);
        } catch (err) {
          console.error("Error", err.message);
          errors.push({ reviews: err.message });
        }
      });
    } else {
      errors.push({ reviews: "Could not find comment element" });
    }

    // SIMILAR ITEMS
    const similarItems = [];
    const similarEl = $(".eb-similar-item__card");

    similarEl.each((i, element) => {
      const item = {};
      try {
        // Get link to similar item
        item.link = $(element)
          .find(".eb-similar-item__name a")
          .attr("href")
          ?.trim();
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ similar_link: err.message });
      }
      // Get similarity tags
      item.tags = [];
      $(element)
        .find(".eb-similar-item__tags .badge")
        .each((index, badgeElement) => {
          try {
            item.tags.push($(badgeElement).text()?.trim());
          } catch (err) {
            console.error("Error", err.message);
            errors.push({ similar_tags: err.message });
          }
        });

      similarItems.push(item);
    });

    // SPECS
    const specs = [];
    const specsEl = $(".table.eb-item__specs-table tbody tr");

    specsEl.each(function () {
      try {
        const name = $(this).find("th").text()?.trim();
        const value = $(this).find("td").text()?.trim();

        specs.push({
          name: name,
          value: value,
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ specs: err.message });
      }
    });

    // GET IMAGE SRC
    let mainPictureLink;
    const mainPictureEl = $(
      "#itemImageCarousel .carousel-inner .carousel-item.active img"
    );

    try {
      const firstImageSrcset = mainPictureEl.attr("data-srcset");
      // Splitting by commas to get each version of the image
      const allLinks = firstImageSrcset?.split(",").map((link) => link?.trim());

      // Taking the last link and splitting by space to get the URL
      mainPictureLink = allLinks
        ? allLinks[allLinks?.length - 1]?.split(" ")[0]
        : "";
    } catch (err) {
      console.error("Error", err.message);
      errors.push({ img_src: err.message });
    }

    // ENQUEUE LINKS TO PRODUCT PICTURES
    const substrings = ["https://", "http://"];
    const containsSubstring = substrings.some((sub) =>
      mainPictureLink?.includes(sub)
    );

    if (mainPictureLink && containsSubstring) {
      try {
        const productPictureRequestQueue = await RequestQueue.open(
          generateRequestQueueName(
            databee.project.data.id,
            databee.data.id,
            LABEL_NAMES.PICTURES_PRODUCTS
          )
        );

        await productPictureRequestQueue.addRequest({
          url: mainPictureLink,
          label: LABEL_NAMES.PICTURES_PRODUCTS,
          userData: { related_entity: path },
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ enqueue_img_src_link: err.message });
      }
    }

    const preparedData = {
      url: request.loadedUrl,
      path: path,
      label: request.label,
      meta_title: meta_title_element.text(),
      meta_description: meta_description_element.attr("content"),
      meta_robot: meta_robot_element.attr("content"),
      name: name,
      img_src: mainPictureLink,
      last_category: last_category,
      categories: categories,
      description: description_element.text(),
      brand_url: brand_url_element.attr("href"),
      eb_score: eb_score_element.text(),
      consensus: consensus_element.text(),
      links: links,
      rating: ratingScore,
      nb_ratings: numOfRatings,
      reviews: reviews,
      similar: similarItems,
      specs: specs,
      crawl_errors: errors,
    };
    if (true) {
      const dataset = await Dataset.open(
        `${databee.project.data.id}__${databee.data.id}`
      );
      await dataset.pushData(preparedData);
    }
    if (true) {
      await apiRequest({
        method: "POST",
        collection: databee.config.raw_data_collection,
        data: {
          data: preparedData,
          entity_type: request.label,
          source: databee.project.data.key,
          project_id: databee.project.data.id,
          run_id: databee.data.id,
          run_session_id: databee.runSession.data.id,
          label: "updater",
        },
        run: databee,
      });
    }

    // ENQUEUE LINKS TO BRAND DETAIL
    const requestQueueBrandDetail = await RequestQueue.open(
      generateRequestQueueName(
        databee.project.data.id,
        databee.data.id,
        LABEL_NAMES.DETAIL_BRANDS
      )
    );

    await enqueueLinks({
      selector: "h1.d-none.d-md-block.mb-4.mt-1 a",
      label: LABEL_NAMES.DETAIL_BRANDS,
      requestQueue: requestQueueBrandDetail,
    });
  },
  DETAILBANDS: async (context, databee, apiRequest) => {
    const { request, log, enqueueLinks, pushData, $ } = context;
    const path = new URL(request.loadedUrl).pathname;
    const errors = [];

    let bandName;
    let img_src = null;
    const members = [];
    const genres = [];
    const similarBands = [];
    const socialData = [];

    try {
      bandName = $(".text-eb-orange").text();
    } catch (err) {
      errors.push({
        error: "Failed to extract band name",
        message: err.message,
      });
    }

    // EXTRACT MEMBERS
    try {
      $(".media").each((index, element) => {
        const memberName = $(element).find("h3.h5 a").text();
        const memberUrl = $(element).find("h3.h5 a").attr("href");
        members.push({
          name: memberName,
          url: memberUrl,
        });
      });
    } catch (err) {
      errors.push({ error: "Failed to extract members", message: err.message });
    }

    // EXTRACT SIMILAR BANDS
    try {
      $(".card").each((index, element) => {
        const bandName = $(element).find(".card-title").text();
        const bandUrl = $(element).find("a").attr("href");
        similarBands.push({
          name: bandName,
          url: bandUrl,
        });
      });
    } catch (err) {
      errors.push({
        error: "Failed to extract similar bands",
        message: err.message,
      });
    }

    // EXTRACT SOCIAL LINKS
    if (true) {
      try {
        $(".d-flex.mb-2.mb-md-1 a.text-muted").each((i, item) => {
          const title = $(item).attr("alt");
          const href = $(item).attr("href");

          if (title && href) {
            socialData.push({
              [title]: href,
            });
          }
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ social_links: err.message });
      }
    }

    // EXTRACT GENRES
    try {
      $(
        ".d-flex.flex-column.flex-md-row.align-items-center.justify-content-center.pb-3 span.badge"
      ).each((index, element) => {
        const genreName = $(element).text();
        const slug = genreName.toLowerCase().replace(/\s+/g, "-"); // Convert genre name to slug format
        const genreUrl = `/genres/${slug}`;
        genres.push({
          name: genreName,
          url: genreUrl,
        });
      });
    } catch (err) {
      errors.push({ error: "Failed to extract genres", message: err.message });
    }

    // GET PICTURE SRC
    try {
      const img_el = $("img.eb-img-lazy").attr("data-original");
      if (!img_el.includes("default-group")) {
        img_src = img_el;
      }
    } catch (err) {
      errors.push({
        error: "Failed to extract picture URL",
        message: err.message,
      });
    }

    // ENQUEUE LINKS TO BAND PICTURES

    // "default-group"

    const substrings = ["https://", "http://"];
    const containsSubstring = substrings.some((sub) => img_src?.includes(sub));

    if (img_src && containsSubstring) {
      try {
        const proPictureRequestQueue = await RequestQueue.open(
          generateRequestQueueName(
            databee.project.data.id,
            databee.data.id,
            LABEL_NAMES.PICTURES_BANDS
          )
        );

        await proPictureRequestQueue.addRequest({
          url: img_src,
          label: LABEL_NAMES.PICTURES_BANDS,
          userData: { related_entity: path },
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ enqueue_band_pictures: err.message });
      }
    }
    const preparedData = {
      url: request.loadedUrl,
      path: path,
      label: request.label,
      meta_title: $("title").text(),
      meta_description: $('meta[name="description"]').attr("content"),
      meta_robot: $('meta[name="robots"]').attr("content"),
      name: bandName,
      image_src: img_src,
      social_links: socialData,
      genres: genres,
      members: members,
      similar: similarBands,
    };
    if (true) {
      const dataset = await Dataset.open(
        `${databee.project.data.id}__${databee.data.id}`
      );
      await dataset.pushData(preparedData);
    }
    if (true) {
      await apiRequest({
        method: "POST",
        collection: databee.config.raw_data_collection,
        data: {
          data: preparedData,
          entity_type: request.label,
          source: databee.project.data.key,
          project_id: databee.project.data.id,
          run_id: databee.data.id,
          run_session_id: databee.runSession.data.id,
          label: "updater",
        },
        run: databee,
      });
    }
  },
  DETAILBRANDS: async (context, databee, apiRequest) => {
    const { request, log, enqueueLinks, pushData, $ } = context;
    const errors = [];
    const path = new URL(request.loadedUrl).pathname;

    const meta_title_element = $("title");
    const meta_description_element = $('meta[name="description"]');
    const meta_robot_element = $('meta[name="robots"]');
    const name_element = $(
      'h1[class="mb-0 h3 font-weight-bold text-uppercase"]'
    );
    const img_src_element = $("div.media.d-md-flex img");

    const img_src = img_src_element.attr("data-original");

    // ENQUEUE LINKS TO BRAND PICTURES
    // "brand-placeholder"

    const substrings = ["https://", "http://"];
    const containsSubstring = substrings.some((sub) => img_src?.includes(sub));

    if (img_src && containsSubstring) {
      try {
        const brandPictureRequestQueue = await RequestQueue.open(
          generateRequestQueueName(
            databee.project.data.id,
            databee.data.id,
            LABEL_NAMES.PICTURES_BRANDS
          )
        );

        await brandPictureRequestQueue.addRequest({
          url: img_src,
          label: LABEL_NAMES.PICTURES_BRANDS,
          userData: { related_entity: path },
        });
      } catch (err) {
        console.error("Error", err.message);
        errors.push({ enqueue_img_src_link: err.message });
      }
    }

    const preparedData = {
      url: request.loadedUrl,
      path: path,
      label: request.label,
      meta_title: meta_title_element.text(),
      meta_description: meta_description_element.attr("content"),
      meta_robot: meta_robot_element.attr("content"),
      name: name_element.text(),
      img_src: img_src,
      crawl_errors: errors,
    };
    if (true) {
      const dataset = await Dataset.open(
        `${databee.project.data.id}__${databee.data.id}`
      );
      await dataset.pushData(preparedData);
    }
    if (true) {
      await apiRequest({
        method: "POST",
        collection: databee.config.raw_data_collection,
        data: {
          data: preparedData,
          entity_type: request.label,
          source: databee.project.data.key,
          project_id: databee.project.data.id,
          run_id: databee.data.id,
          run_session_id: databee.runSession.data.id,
          label: "updater",
        },
        run: databee,
      });
    }
  },
};

async function removeOverlays(
  page,
  timeout = 400,
  overlaysSelectors = "#__cmp_overlay, #__cmp_body"
) {
  await page.evaluate((selector) => {
    const overlaysEl = document.querySelectorAll(selector);
    overlaysEl.forEach((overlay) => overlay.remove());
  }, overlaysSelectors);
  await page.waitForTimeout(timeout);
}

function extractSubmissionId(url) {
  const match = url.match(/\/submissions\/(\d+)/);
  return match ? match[1] : null;
}

async function extractData(page, submissionId) {
  return await page.evaluate((submissionId) => {
    const errors = [];
    const element = document.querySelector(
      `div.card.mb-3.eb-custom-card.smaller-text[data-submission-id="${submissionId}"]`
    );
    if (!element) {
      errors.push(`Element with submission ID ${submissionId} not found`);
      return { errors };
    }

    const transformOccurrenceStatus = (str) => {
      const parts = str.split(",", 2);
      let statusString = parts[0].trim().toLowerCase();
      const obj = {
        status: "",
        supported_via: "",
      };

      if (
        [
          "correct verified",
          "verified correct",
          "correct",
          "correct unverified",
          "unverified correct",
        ].includes(statusString)
      ) {
        obj.status = "correct-verified";
      } else if (statusString === "unverified") {
        obj.status = "needs-review";
      } else if (
        ["marked incorrect", "incorrect", "verified incorrect"].includes(
          statusString
        )
      ) {
        obj.status = "incorrect";
      } else if (
        ["partially correct", "needs improvement"].includes(statusString)
      ) {
        obj.status = "needs-improvement";
      }

      if (parts?.length > 1) {
        obj.supported_via = parts[1].replace(/supported via/i, "").trim();
      }

      return obj;
    };

    let badgeText,
      upvoteCount,
      sourceURL,
      sourceIMG,
      description,
      context = {},
      numberOfComments,
      itemPath;

    try {
      itemPath = element.querySelector("h3.card-title a").getAttribute("href");
    } catch (error) {
      errors.push("Error extracting item: " + error.message);
    }

    try {
      badgeText = transformOccurrenceStatus(
        element.querySelector("span.badge").textContent
      );
    } catch (error) {
      errors.push("Error extracting badgeText: " + error.message);
    }

    try {
      const upvoteCountEl = element.querySelector("span.upvote-count");
      upvoteCount = parseInt(upvoteCountEl.textContent?.trim(), 10);
    } catch (error) {
      errors.push("Error extracting upvoteCount: " + error.message);
    }

    try {
      sourceURL = element
        .querySelector(
          'div[id*="submission_details_inner_"] a.text-muted.text-break'
        )
        ?.getAttribute("href");
    } catch (error) {
      errors.push("Error extracting sourceURL: " + error.message);
    }

    try {
      sourceIMG = element
        .querySelector(
          'div[id*="submission_details_inner_"] div.mb-3 div.text-center a.text-muted'
        )
        ?.getAttribute("href");
    } catch (error) {
      errors.push("Error extracting sourceIMG: " + error.message);
    }

    try {
      description = element.querySelector(
        "div.eb-submission__annotation-container p:not([class])"
      ).textContent;
    } catch (error) {
      errors.push("Error extracting description: " + error.message);
    }

    try {
      let contextEl = element.querySelector(".eb-submission__context");
      if (contextEl) {
        let key = contextEl
          .querySelector("strong")
          .textContent?.replace(":", "")
          .trim();
        let value = contextEl.textContent
          ?.replace(contextEl.querySelector("strong").textContent, "")
          .trim();
        context[key.toLowerCase()] = value;
      }
    } catch (error) {
      errors.push("Error extracting context: " + error.message);
    }

    try {
      let anchorElement = element.querySelector(".show-submission-comments");
      let content = anchorElement.textContent;
      let match = content.match(/\d+/);
      numberOfComments = match ? parseInt(match[0], 10) : 0;
    } catch (error) {
      errors.push("Error extracting numberOfComments: " + error.message);
    }

    return {
      itemPath,
      badgeText,
      upvoteCount,
      sourceURL,
      sourceIMG,
      description,
      context,
      numberOfComments,
      errors,
    };
  }, submissionId);
}

async function handleImage(data, submissionId, databee) {
  if (data.sourceIMG) {
    try {
      const proPictureRequestQueue = await RequestQueue.open(
        generateRequestQueueName(
          databee.project.data.id,
          databee.data.id,
          LABEL_NAMES.PICTURES_OCCURRENCES
        )
      );

      await proPictureRequestQueue.addRequest({
        url: data.sourceIMG,
        label: LABEL_NAMES.PICTURES_OCCURRENCES,
        userData: { related_entity: `/submissions/${submissionId}` },
      });
    } catch (err) {
      console.error("Error", err.message);
      data.errors.push({ enqueue_occurrence_pictures: err.message });
    }
  }
}

function prepareDataForPush(data, request, proPath, submissionId, databee) {
  const itemURLParts = data.itemPath?.split("/");
  const itemSlug = itemURLParts[itemURLParts?.length - 1];

  return {
    url: request.loadedUrl,
    pro: proPath,
    item: data.itemPath,
    occurrence_id: submissionId,
    occurrence_path: `/submissions/${submissionId}`,
    occurrence_nice_path: `${proPath}/${itemSlug}`,
    occurrence_url: `${databee.project.data.base_url}/submissions/${submissionId}`,
    occurrence_nice_url: `${databee.project.data.base_url}${proPath}/${itemSlug}`,
    status: data.badgeText.status,
    supported_via: data.badgeText.supported_via,
    upvotes: data.upvoteCount,
    source_url: data.sourceURL,
    source_img: data.sourceIMG,
    description: data.description,
    context: data.context,
    comment_nb: data.numberOfComments,
    crawl_errors: data.errors,
    approx_date_published: request.userData.approx_date_published,
    run_id: databee.data.id,
  };
}

export async function getApproxPublishDate(timeText) {
  try {
    // Extended regex to include "less than 1 minute ago"
    const timeRegex =
      /(?:about )?(\d+) (minute|hour|day|week|month|year)s?|less than a minute ago/;

    const match = timeText.match(timeRegex);
    let datePublished = null;

    if (match) {
      if (match[0] === "less than a minute ago") {
        // Set datePublished to current time for "less than a minute ago"
        datePublished = new Date();
      } else {
        const number = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
          case "minute":
            datePublished = new Date(Date.now() - number * 60 * 1000);
            break;
          case "hour":
            datePublished = new Date(Date.now() - number * 60 * 60 * 1000);
            break;
          case "day":
            datePublished = new Date(Date.now() - number * 24 * 60 * 60 * 1000);
            break;
          // Add cases for week, month, year, etc. if needed
          default:
            console.log(`Unknown time unit: ${unit}`);
        }
      }

      console.log(
        `Approximate publish date for card: ${datePublished} with ${timeText}`
      );
    } else {
      console.log("Failed to parse time text:", timeText);
    }

    return datePublished;
  } catch (error) {
    console.error("Error occurred in getApproxPublishDate:", error);
    // You might want to handle the error or rethrow it depending on your application's needs
    throw error; // or return a default value, or just return;
  }
}

function prepareLink(rawLink) {
  let preparedLink = rawLink;
  let rootDomain = "https://equipboard.com";

  // Check if the link contains "https://", "http://"
  const substrings = ["https://", "http://"];
  const containsSubstring = substrings.some((sub) => rawLink?.includes(sub));
  preparedLink = !containsSubstring ? rootDomain + rawLink : rawLink;
  return preparedLink;
}

function getPathFromUrl(inputUrl) {
  const parsedUrl = new URL(inputUrl);
  return parsedUrl.pathname;
}

async function calculateTimeSpent(dateStart, dateEnd) {
  const startDate = new Date(dateStart);
  const endDate = new Date(dateEnd);

  let timeSpent = endDate - startDate; // difference in milliseconds

  if (timeSpent < 0) {
    return "End date is before start date";
  }

  let seconds = Math.floor(timeSpent / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  const hours = Math.floor(minutes / 60);
  minutes = minutes % 60;

  let result = [];
  if (hours > 0) result.push(`${hours} hours`);
  if (minutes > 0) result.push(`${minutes} minutes`);
  if (seconds > 0 || result.length === 0) result.push(`${seconds} seconds`);

  return result.join(", ").replace(/, ([^,]*)$/, " and $1");
}

function generateRequestQueueName(projectId, runId, label) {
  return `${projectId}__${runId}/${label}`;
}
