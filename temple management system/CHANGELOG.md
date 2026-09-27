# Changelog

## v1.1

- **Fixed:** orders placed under a newly created POS category were missing from "All Orders" (Payments list, and Dashboard's "Orders Today" count), even though they showed correctly in Reports. Caused by a hardcoded list of recognized category codes that new categories weren't added to; replaced with logic that treats any transaction as an order unless it's a hall booking payment.
- **Fixed:** Payments page "Type" column showed the raw category code (e.g. `NEW_CATEGORY`) for transactions from newly created POS categories instead of "POS Order". Type is now always one of exactly 3 buckets: POS Order, Hall Booking, Membership.
- **Added:** mobile POS view now shows Cash, DuitNow QR, and Reprint last receipt buttons in the Order Chit view — previously only available on desktop/system view.
- **Added:** Temple Config category tabs can now be hidden from the POS counter individually (Eye/EyeOff toggle next to Rename/Delete), separate from the existing per-item show/hide toggle.
- **Fixed:** the Paper Width setting (58mm/80mm) in Settings → Receipt was saved but never applied — all chits printed at a fixed 80mm regardless of the setting. Both the printed receipt and the on-screen live preview now follow the configured width.
