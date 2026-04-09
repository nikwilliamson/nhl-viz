export interface TeamStyle {
  name: string;
  primaryColor: string;
  secondaryColors: string[];
}

export const teamStyles: Record<string, TeamStyle> = {
  ANA: {
    name: "Anaheim Ducks",
    primaryColor: "#cf4520",
    secondaryColors: ["#010101", "#ffffff", "#89734c"],
  },
  ARI: {
    name: "Arizona Coyotes",
    primaryColor: "#a9431e",
    secondaryColors: [
      "#ddcba4",
      "#5f259f",
      "#010101",
      "#154734",
      "#6f263d",
      "#000000",
    ],
  },
  BOS: {
    name: "Boston Bruins",
    primaryColor: "#ffb81c",
    secondaryColors: ["#010101", "#ffffff"],
  },
  BUF: {
    name: "Buffalo Sabres",
    primaryColor: "#003087",
    secondaryColors: ["#c8102e", "#ffffff", "#ffb81c"],
  },
  CAR: {
    name: "Carolina Hurricanes",
    primaryColor: "#cd001a",
    secondaryColors: ["#010101", "#a2aaad", "#ffffff"],
  },
  CBJ: {
    name: "Columbus Blue Jackets",
    primaryColor: "#041e42",
    secondaryColors: ["#a2aaad", "#ffffff", "#c8102e"],
  },
  CGY: {
    name: "Calgary Flames",
    primaryColor: "#c8102e",
    secondaryColors: ["#f1be48"],
  },
  CHI: {
    name: "Chicago Blackhawks",
    primaryColor: "#c8102e",
    secondaryColors: [
      "#010101",
      "#f5812b",
      "#213b88",
      "#d9a510",
      "#fedd00",
      "#ffffff",
      "#008755",
    ],
  },
  COL: {
    name: "Colorado Avalanche",
    primaryColor: "#862633",
    secondaryColors: ["#236192", "#ffffff", "#010101", "#c1c6c8"],
  },
  DAL: {
    name: "Dallas Stars",
    primaryColor: "#00843d",
    secondaryColors: ["#010101", "#a2aaad", "#ffffff"],
  },
  DET: {
    name: "Detroit Red Wings",
    primaryColor: "#c8102e",
    secondaryColors: ["#ffffff"],
  },
  EDM: {
    name: "Edmonton Oilers",
    primaryColor: "#00205b",
    secondaryColors: ["#ffffff", "#cf4520"],
  },
  FLA: {
    name: "Florida Panthers",
    primaryColor: "#041e42",
    secondaryColors: ["#b9975b", "#c8102e", "#ffffff", "#010101"],
  },
  LAK: {
    name: "Los Angeles Kings",
    primaryColor: "#a2aaad",
    secondaryColors: ["#010101", "#ffffff"],
  },
  MIN: {
    name: "Minnesota Wild",
    primaryColor: "#154734",
    secondaryColors: ["#ddcba4", "#a6192e", "#eaaa00", "#ffffff"],
  },
  MTL: {
    name: "Montréal Canadiens",
    primaryColor: "#a6192e",
    secondaryColors: ["#ffffff", "#001e62"],
  },
  NHL: {
    name: "NHL",
    primaryColor: "#d0d3d4",
    secondaryColors: ["#010101", "#ffffff"],
  },
  NJD: {
    name: "New Jersey Devils",
    primaryColor: "#cd001a",
    secondaryColors: ["#010101", "#ffffff"],
  },
  NSH: {
    name: "Nashville Predators",
    primaryColor: "#ffb81c",
    secondaryColors: ["#ffffff", "#041e42"],
  },
  NYI: {
    name: "New York Islanders",
    primaryColor: "#003087",
    secondaryColors: ["#fc4c02", "#ffffff"],
  },
  NYR: {
    name: "New York Rangers",
    primaryColor: "#0033a0",
    secondaryColors: ["#ffffff", "#c8102e"],
  },
  OTT: {
    name: "Ottawa Senators",
    primaryColor: "#b9975b",
    secondaryColors: ["#010101", "#c8102e", "#ffffff"],
  },
  PHI: {
    name: "Philadelphia Flyers",
    primaryColor: "#fc4c02",
    secondaryColors: ["#010101", "#ffffff"],
  },
  PIT: {
    name: "Pittsburgh Penguins",
    primaryColor: "#ffb81c",
    secondaryColors: ["#010101", "#ffffff"],
  },
  SEA: {
    name: "Seattle Kraken",
    primaryColor: "#9cdbd9",
    secondaryColors: ["#041c2c", "#c8102e", "#6ba4b8"],
  },
  SJS: {
    name: "San Jose Sharks",
    primaryColor: "#00778b",
    secondaryColors: ["#ffffff", "#010101", "#e57200"],
  },
  STL: {
    name: "St. Louis Blues",
    primaryColor: "#006ac6",
    secondaryColors: ["#ffb81c"],
  },
  TBL: {
    name: "Tampa Bay Lightning",
    primaryColor: "#00205b",
    secondaryColors: [],
  },
  TOR: {
    name: "Toronto Maple Leafs",
    primaryColor: "#00205b",
    secondaryColors: ["#ffffff"],
  },
  UTA: {
    name: "Utah Hockey Club",
    primaryColor: "#6cace4",
    secondaryColors: ["#ffffff", "#010101"],
  },
  VAN: {
    name: "Vancouver Canucks",
    primaryColor: "#00205b",
    secondaryColors: ["#041c2c", "#ffffff", "#97999b"],
  },
  VGK: {
    name: "Vegas Golden Knights",
    primaryColor: "#b9975b",
    secondaryColors: ["#010101", "#ffffff", "#333f48"],
  },
  WPG: {
    name: "Winnipeg Jets",
    primaryColor: "#041e42",
    secondaryColors: ["#a2aaad", "#ffffff", "#782f40", "#a6192e", "#53565a"],
  },
  WSH: {
    name: "Washington Capitals",
    primaryColor: "#041e42",
    secondaryColors: ["#ffffff", "#c8102e"],
  },
};
