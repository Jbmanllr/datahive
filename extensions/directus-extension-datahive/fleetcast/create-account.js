import { Dataset, PlaywrightCrawler } from "crawlee";

export async function createAccount(email, username, password) {
  // Create an instance of the PlaywrightCrawler class - a crawler
  // that automatically loads the URLs in headless Chrome / Playwright.
  const crawler = new PlaywrightCrawler({
    launchContext: {
      // Here you can set options that are passed to the playwright .launch() function.
      launchOptions: {
        headless: false,
      },
    },

    // Stop crawling after several pages
    maxRequestsPerCrawl: 50,

    
    
    // This function will be called for each URL to crawl.
    // Here you can write the Playwright scripts you are familiar with,
    // with the exception that browsers and pages are automatically managed by Crawlee.
    // The function accepts a single parameter, which is an object with a lot of properties,
    // the most important being:
    // - request: an instance of the Request class with information such as URL and HTTP method
    // - page: Playwright's Page object (see https://playwright.dev/docs/api/class-page)
    async requestHandler({ request, page, enqueueLinks, log }) {
      /* if ((email || username) && password) {
      } else {
        console.log(
          "Invalid input: Both mail (or username) and password are required."
        );
        return;
      }*/

      //const storedCookies = await KeyValueStore.getValue("SESSION_COOKIES");

      // If no stored cookies, navigate to the login page and perform login
      //await page.goto("https://equipboard.com/login");

      const birthDate = "1985-11-18";
      const birthDateObject = new Date(birthDate);

      // Extract the year, month, and day
      const year = birthDateObject.getFullYear();
      // getMonth() returns 0-11, so add 1 for a 1-12 range
      const month = birthDateObject.getMonth() + 1;
      const day = birthDateObject.getDate();

        // Wait for the page to load
  await page.waitForLoadState('domcontentloaded');

  // Select the last button within a specific container
  // Adjust the container selector as needed to accurately target the desired container
  const buttons = page.locator('div[role="group"] >> css=div[role="button"]');
  const lastButton = buttons.last();
  await lastButton.click();

      // Selector using the 'name' attribute
      const nameInputSelector = 'input[name="name"]';
      await page.fill(nameInputSelector, "Nom Prénom");

      const emailInputSelector = 'input[name="email"]';
      await page.fill(emailInputSelector, email);

      // Select the month (November - 11)
      await page.selectOption("#SELECTOR_1", month);

      // Select the day (18)
      await page.selectOption("#SELECTOR_2", day);

      // Select the year (1985)
      await page.selectOption("#SELECTOR_3", year);

      var firstStepContinue = document.querySelector(
        'div[aria-label="Fermer"][role="button"]'
      );
      // Check if the button is found
      if (firstStepContinue) {
        // Simulate a click
        firstStepContinue.click();
      } else {
        console.log("Close button not found");
      }

      // Wait for 3 seconds
    await page.waitForTimeout(3000);

    // Click the second button (assuming it's uniquely identified by the given attributes)
    await page.click('div[role="button"][data-testid="ocfSettingsListNextButton"]');

    await page.waitForTimeout(3000);
    await page.click('[data-testid="ocfSignupReviewNextLink"]');


      // Wait for login to complete (e.g., by waiting for a specific element that indicates successful login)
      await page.waitForSelector('a.dropdown-item[href="/logout"]');

      // Store the session cookies for future use
      const cookies = await page.context().cookies();
      await KeyValueStore.setValue("SESSION_COOKIES", cookies);
    },

    // This function is called if the page processing failed more than maxRequestRetries+1 times.
    failedRequestHandler({ request, log }) {
      log.info(`Request ${request.url} failed too many times.`);
    },
  });

  await crawler.addRequests(["https://twitter.com/i/flow/signup/"]);

  // Run the crawler and wait for it to finish.
  await crawler.run();
}
