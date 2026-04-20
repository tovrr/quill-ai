"use client";

import { CardElement, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";

interface StripeElementProps {
  elementType: "card" | "number" | "expiry" | "cvc";
  className?: string;
}

export function StripeElement({ elementType, className }: StripeElementProps) {
  const options = {
    style: {
      base: {
        fontSize: "16px",
        color: "#A1A7B0",
        fontFamily: "system-ui, sans-serif",
        "::placeholder": {
          color: "#6F737A",
        },
      },
      invalid: {
        color: "#EF4444",
      },
    },
  };

  let ElementComponent;

  switch (elementType) {
    case "card":
      ElementComponent = CardElement;
      break;
    case "number":
      ElementComponent = CardNumberElement;
      break;
    case "expiry":
      ElementComponent = CardExpiryElement;
      break;
    case "cvc":
      ElementComponent = CardCvcElement;
      break;
    default:
      ElementComponent = CardElement;
  }

  return <ElementComponent options={options} className={className} />;
}
