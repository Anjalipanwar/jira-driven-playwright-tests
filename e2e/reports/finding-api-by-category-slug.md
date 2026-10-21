# Finding: product category filter used by the UI is not in the API docs

| | |
|---|---|
| Found during | SCRUM-6 exploration, 2026-10-21 |
| Type | API documentation gap (not a functional failure) |
| Severity | Low: the shop works; API users can't reproduce category listings from the docs |
| App | <https://practicesoftwaretesting.com/> (API <https://api.practicesoftwaretesting.com>) |
| Status | Draft, not filed anywhere |

## Summary

The category page loads its products with a filter called `by_category_slug`, which the
Swagger documentation does not list. The documented filter, `by_category`, returns no
products for a top-level category such as Hand Tools.

## Steps to reproduce

All requests are read-only.

1. Open <https://practicesoftwaretesting.com/category/hand-tools>.
2. In the browser network log, find the products request. It is
   `QUERY /products` with body `{"page":"1","by_category_slug":"hand-tools"}`.
3. Open the Swagger docs at <https://api.practicesoftwaretesting.com/api/documentation>
   (spec: `/docs?api-docs.json`). Under `GET /products` and `QUERY /products`, the
   documented filters are `by_brand`, `by_category`, `is_rental`, `between`, `sort`, `page`.
   `by_category_slug` is not listed.
4. `GET /products?by_category_slug=hand-tools&page=1` returns 200, `total` 25, and the same
   first products as the page (Combination Pliers, Pliers, Bolt Cutters).
5. Get the Hand Tools id from `GET /categories/tree`, then call
   `GET /products?by_category=<that id>&page=1`. It returns 200 with `total` 0.

## Expected

The docs describe how to list a category's products the same way the UI does. Either
`by_category_slug` is documented, or `by_category` with a parent category id also returns
the products of its subcategories (Hand Tools has 7: Hammer, Hand Saw, Wrench, Screwdriver,
Pliers, Chisels, Measures).

## Actual

`by_category_slug` works but is undocumented. `by_category` with the parent id returns
nothing, because the products belong to the subcategories.

## Also noted

The default sort order of `/products` is not documented. The UI sends no `sort`, and the
order was stable across all calls during the SCRUM-6 runs.
