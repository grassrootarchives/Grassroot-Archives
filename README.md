# Grassroot Archives

A map-led archive of river valleys: interviews, photographs, sound and text placed on maps, from the headwaters to the household.

- **Public site:** Home, About, a Valley map for every valley (filters, live readout, map layers, legend, elevation profile and a story drawer), a River index, and custom pages.
- **Admin (CMS)** at `/admin/`: river basins (upload a georeferenced elevation model or contour lines and the valley map is generated in the browser), stories placed by latitude/longitude, a block-based page editor with site theme, settings and admins.
- **Three map styles** for every valley, drawn from the same terrain: contour survey, watercolour and miniature painting, with settlement and water-infrastructure layers and matching legends.

The site is plain HTML, CSS and JavaScript (ES modules), with no build step. It is hosted on GitHub Pages; data, logins and files live in Supabase.

## How it fits together

```
index.html, about.html, page.html      block pages (content from the `pages` table)
valley.html?v=<slug>                   valley map page (template page + map app)
river-index.html?v=<slug>              story table for a valley
admin/*.html                           the CMS (login required)
assets/css/site.css, admin.css         design tokens and components (see the design guide)
assets/js/map/                         SVG map renderer and the three styles
assets/js/geo/                         contours, river tracing, GeoTIFF/contour/layer import
assets/js/pages/, admin/               page scripts
assets/demo/                           data files for the demo valley
supabase/migrations/, seed.sql         database schema, security rules and starting content
```

Libraries loaded from a CDN only where needed: `@supabase/supabase-js`, and in the admin `geotiff`, `proj4`, `shpjs` and `@tmcw/togeojson`.

## One-time setup

### 1. GitHub Pages
Repository **Settings → Pages**: Source "Deploy from a branch", branch `main`, folder `/ (root)`. The `CNAME` file sets the custom domain to `grassrootarchives.org`; tick **Enforce HTTPS** once the DNS check passes.

DNS at the registrar: four `A` records on `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` on `www` → `grassrootarchives.github.io`.

### 2. Supabase authentication URLs (required for logins)
Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://grassrootarchives.org`
- **Redirect URLs:** add `https://grassrootarchives.org/admin/login.html` (and `https://grassrootarchives.github.io/**` if you also use that address).

Without this, confirmation and password-reset emails link to `localhost`.

### 3. First admin
`grassrootarchives@gmail.com` is on the admin list. Open `/admin/login.html`, choose **First time here? Create your password**, confirm the email, then log in. Add more admins under **Settings**.

## Adding a river valley

1. **Admin → River basins → New river basin.**
2. Upload an elevation model (GeoTIFF, any coordinate system proj4 knows; UTM zones work offline) or contour lines (GeoJSON, zipped Shapefile, KML) with an elevation attribute. Free elevation data: SRTM 30 m or Copernicus GLO-30 from [OpenTopography](https://opentopography.org) or [USGS EarthExplorer](https://earthexplorer.usgs.gov). Clip it to your basin first (QGIS: Raster → Extraction → Clip).
3. **Process map.** The river and watershed are traced automatically, or upload your own lines.
4. Fill in the name, the map data source (credited on the map), zones and style; add settlements and water infrastructure (file or OpenStreetMap import).
5. **Publish.** The valley gets its page and joins the valley menu.

Map files are stored in the `maps` storage bucket; story media in `media`.

## Security model

The anon key in `assets/js/config.js` is public by design. Row-level security in the database decides access: anyone can read published valleys, stories and pages; only emails in `public.admins` can write anything or upload files. Stories can only be published once consent is recorded (enforced by the database).

## Local preview

```
python3 -m http.server 8000
```
then open `http://localhost:8000/`. Add `http://localhost:8000/admin/login.html` to the Supabase redirect URLs to log in locally.

## The demo valley

"Demo valley (sample data)" uses made-up terrain, settlements, water works and stories so every feature can be seen. Unpublish or delete it from the admin once real valleys are in.
