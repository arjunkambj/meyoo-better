import type { ButtonProps } from "@heroui/button";

export enum FrequencyEnum {
  Monthly = "monthly",
  Yearly = "yearly",
}

export enum TiersEnum {
  Free = "free",
  Pro = "pro",
  Team = "team",
  Custom = "custom",
  Enterprise = "enterprise",
}

export type Frequency = {
  key: FrequencyEnum;
  label: string;
  priceSuffix: string;
};

export type Tier = {
  key: TiersEnum;
  title: string;
  price:
    | {
        [FrequencyEnum.Monthly]: string;
        [FrequencyEnum.Yearly]: string;
      }
    | string;
  priceSuffix?: string;
  href: string;
  description?: string;
  mostPopular?: boolean;
  featured?: boolean;
  features?: string[];
  buttonText: string;
  buttonColor?: ButtonProps["color"];
  buttonVariant: ButtonProps["variant"];
};
