const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const stripe = require('stripe')('sk_test_51Isp9eLjpdOyivM3byTsDhyQJl1nYGLr6nnsxhqX3iZlOMOJ4k4bfEcszqSXlS7YDtjTexrE5dmcRXdFfJILGm0u00yR1JyFp8');

const port = 3001

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use(cors())

app.post('/pay', async (req, res) => {
    const {email} = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
        amount: 5000,
        currency: 'usd',
        // Verify your integration in this guide by including this parameter
        metadata: {integration_check: 'accept_a_payment'},
        receipt_email: email,
      });

      res.json({'client_secret': paymentIntent['client_secret']})
})

app.post('/sub', async (req, res) => {
  const {email, payment_method} = req.body;

  const customer = await stripe.customers.create({
    payment_method: payment_method,
    email: email,
    invoice_settings: {
      default_payment_method: payment_method,
    },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ plan: 'price_1IspDtLjpdOyivM3Hqzn8yhf' }],
    expand: ['latest_invoice.payment_intent']
  });
  
  const status = subscription['latest_invoice']['payment_intent']['status'] 
  const client_secret = subscription['latest_invoice']['payment_intent']['client_secret']
  const customer_obj = JSON.stringify(customer)
  const stringSubscription = JSON.stringify(subscription)

  res.json({'client_secret': client_secret, 'status': status, 'customer_obj': customer_obj, 'subscription_obj': stringSubscription});
})

app.post('/create-customer-portal-session', async (req, res) => {
  //req body
  const {customerId} = req.body;
  // Authenticate your user.
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: 'http://localhost:3000/',
  });

  res.json({'redirectUrl': session.url})
});

app.post('/get-customer-data', async (req, res) =>{
  const {subId} = req.body;

  const subscription = await stripe.subscriptions.retrieve(
    subId
  );
  
  const subscriptionString = JSON.stringify(subscription)

  res.json({'subscriptionDetails': subscriptionString})
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))