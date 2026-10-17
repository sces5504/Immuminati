/** Anatomy is independent of wave/immune rules. These profiles are not extra playable levels. */
export const tissueProfiles = {
  lymphoid: {
    name: "引流淋巴組織",
    structure: "濾泡、旁皮質與網狀基質；CD4 淋巴球位於組織間隙",
    floor: 0xc3a3ba,
    wall: 0xd8bacd,
    vessel: 0xa16c8b,
    pattern: "follicles",
  },
  lung: {
    name: "肺泡組織",
    structure: "相通肺泡腔、薄肺泡隔與沿隔微血管網",
    floor: 0xdcb6bd,
    wall: 0xc28b9f,
    vessel: 0x985475,
    pattern: "alveoli",
  },
  oral: {
    name: "口腔黏膜",
    structure: "分層鱗狀上皮、緊密細胞接合與下方固有層",
    floor: 0xcfa2ae,
    wall: 0xe6bac4,
    vessel: 0xa26181,
    pattern: "epithelium",
  },
  intestinal: {
    name: "腸黏膜",
    structure: "指狀絨毛、上皮屏障與絨毛內微血管",
    floor: 0xcf9b9b,
    wall: 0xe7b8ae,
    vessel: 0xa86a7e,
    pattern: "villi",
  },
} as const;
