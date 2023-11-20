import nodemailer from "nodemailer";
import { md5 } from "js-md5";
import axios from "axios";
import { createAccount } from "./create-account.js";

await generateMail();

async function generateMail() {
  try {
    //const domains = await getDomains();
    //const mail = await createMail(domains);
    const mail = "test@test.com";
    const mailMD5 = md5(mail);

    const response = await apiRequest({
      method: "POST",
      collection: "fleetcast_emails",
      data: {
        mail: mail,
        md5: mailMD5,
        provider: "temp_mail",
      },
    });

    console.log("mail", response);
    await createAccount("williamwilson5929@cpav3.com", "williamwilson5929", "989768982HtyHjskiJ");
  } catch (e) {
    console.error(e);
  }
}

async function getDomains() {
  const options = {
    method: "GET",
    url: "https://privatix-temp-mail-v1.p.rapidapi.com/request/domains/",
    headers: {
      "X-RapidAPI-Key": "ff6cd0d1a6msh67bd0c2cf1bc4ddp1063c7jsn1019ad5a1f2a",
      "X-RapidAPI-Host": "privatix-temp-mail-v1.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

async function createMail(domains) {
  const randomDomain = getRandomElement(domains);
  const randomName = generateRandomName();
  const number = generateRandomNumber();
  const mail = randomName.toLowerCase() + number + randomDomain;
  return mail;
}

async function testMail() {
  try {
    await sendEmail();
  } catch (error) {}
}
async function sendEmail() {
  // Create a transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.example.com", // Replace with your mail server host
    port: 587, // For secure SMTP, use port 465. For non-secure, use port 587
    secure: false, // true for 465, false for other ports
    auth: {
      user: "your-email@example.com", // Replace with your email
      pass: "your-password", // Replace with your email password
    },
  });

  // Send mail with defined transport object
  let info = await transporter.sendMail({
    from: '"Your Name" <your-email@example.com>', // Sender address
    to: "recipient@example.com", // List of recipients
    subject: "Hello ✔", // Subject line
    text: "Hello world?", // Plain text body
    html: "<b>Hello world?</b>", // HTML body content
  });

  console.log("Message sent: %s", info.messageId);
}

function generateRandomName() {
  const firstNames = [
    "John",
    "Jane",
    "Emily",
    "Michael",
    "Sarah",
    "William",
    "Jessica",
    "David",
    "Sophia",
    "Daniel",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Miller",
    "Davis",
    "Garcia",
    "Rodriguez",
    "Wilson",
  ];

  const firstName = getRandomElement(firstNames);
  const lastName = getRandomElement(lastNames);

  return `${firstName}${lastName}`;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomNumber(length = 4) {
  const max = Math.pow(10, length) - 1; // Calculate the maximum number for the given length
  const randomNumber = Math.floor(Math.random() * (max + 1)); // Generates a number between 0 and max
  return String(randomNumber).padStart(length, "0"); // Pads with leading zeros if necessary
}

export async function apiRequest({
  method,
  collection,
  data = null,
  params = null,
  id,
  isErrorReport = false,
  run,
  fields = "",
}) {
  const endpoint = id
    ? `http://0.0.0.0:8055/items/${collection}/${id}${fields}`
    : `http://0.0.0.0:8055/items/${collection}`;

  try {
    const config = {
      method: method,
      url: endpoint,
      headers: {
        Authorization: `Bearer mYYPJypxN5ecLk2bxz-kztKpL_8oinXT`,
        "Content-Type": "application/json",
      },
    };

    if (method === "GET") {
      config.params = params;
    } else {
      config.data = data;
    }

    const response = await axios(config);

    if (method === "POST") {
      //console.log(
      //  `${isErrorReport ? "Error" : "Data"} successfully added to ${collection} :D ! Entry ID ${response.data.data.id}`
      //);
    }

    if (method === "PATCH") {
      //console.log(
      //  `${collection}'s entry ID ${response.data.data.id} updated successfully :D !`
      //);
    }

    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.errors) {
      for (const err of error.response.data.errors) {
        if (!isErrorReport) {
          try {
            await apiRequest({
              method: "POST",
              collection: "databee_run_reports",
              data: {
                type: "info",
                run_id: run?.data.id,
                item_id: data?.raw_data_id,
                code: err.extensions.code,
                message: err.message,
                raw_data: error,
              },
              isErrorReport: true,
            });
          } catch (error) {
            console.log("ERROR SENDING ERROR:", error.message);
          }
        }

        console.error(
          `ERROR: "${err.extensions.code}" ${method} DATA TO DIRECTUS FOR "${data?.url}": ${err.message}`
        );
      }
    } else {
      console.error(
        `Error ${method} data to Directus for ${data ? data.url : ""}:`,
        error.message
      );
    }
  }
}