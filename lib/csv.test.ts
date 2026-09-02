import { describe, it, expect } from "vitest";
import { parseCsv, toCsv, csvCell, contactsFromCsv } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas and quotes", () => {
    expect(parseCsv('name,note\n"Ali, A","he said ""hi"""')).toEqual([
      ["name", "note"],
      ["Ali, A", 'he said "hi"'],
    ]);
  });

  it("handles embedded newlines in quotes and CRLF", () => {
    expect(parseCsv('a\r\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });

  it("ignores a trailing newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("toCsv / csvCell", () => {
  it("quotes only when needed", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it("round-trips through parseCsv", () => {
    const rows = [
      ["name", "email"],
      ["Ali, A", "ali@x.com"],
      ['quote"d', "b@x.com"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("renders null/number cells", () => {
    expect(toCsv([["a", 1, null]])).toBe("a,1,");
  });
});

describe("contactsFromCsv", () => {
  it("maps header aliases and drops rows without email or phone", () => {
    const rows = parseCsv(
      "Full Name,Email,Phone,Subscribed\nSara,sara@x.com,,yes\nNoContact,,,\nOmar,,+100,no"
    );
    expect(contactsFromCsv(rows)).toEqual([
      { display_name: "Sara", email: "sara@x.com", phone: null, company: null, is_subscribed: true },
      { display_name: "Omar", email: null, phone: "+100", company: null, is_subscribed: false },
    ]);
  });

  it("maps the company/organization column", () => {
    const rows = parseCsv("email,company\na@x.com,Acme Inc");
    expect(contactsFromCsv(rows)[0].company).toBe("Acme Inc");
  });

  it("defaults subscribed to true when the column is absent", () => {
    const rows = parseCsv("name,email\nSara,sara@x.com");
    expect(contactsFromCsv(rows)[0].is_subscribed).toBe(true);
  });

  it("returns [] with no data rows", () => {
    expect(contactsFromCsv(parseCsv("name,email"))).toEqual([]);
  });

  it("ignores unknown columns", () => {
    const rows = parseCsv("email,junk\na@x.com,whatever");
    expect(contactsFromCsv(rows)).toEqual([
      { display_name: null, email: "a@x.com", phone: null, company: null, is_subscribed: true },
    ]);
  });
});
