import { requireAdmin, layout, toast, errMsg } from './common.js';
import { esc } from '../ui.js';

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('settings');
const [{ data: settings }, { data: admins }] = await Promise.all([sb.from('site_settings').select('*').eq('id', 1).single(), sb.from('admins').select('*').order('email')]);
const main = layout(app, 'settings', user, `
  <div class="admin__head"><div><span class="eyebrow">Settings</span><h1>Site settings</h1></div></div>
  <div class="cols">
    <section class="panel" aria-labelledby="h-site"><h2 id="h-site">Site</h2>
      <label class="field"><span>Site name</span><input data-name value="${esc(settings?.site_name || '')}"></label>
      <label class="field"><span>Public contact email</span><input type="email" data-email value="${esc(settings?.contact_email || '')}"><span class="hint">Shown as a Contact link in the footer. Leave empty to hide it.</span></label>
      <div><button type="button" class="btn btn--primary" data-savesite>Save</button></div>
      <p class="muted" style="margin:0">Colours and fonts are set in Pages &amp; design.</p>
    </section>
    <section class="panel" aria-labelledby="h-admins"><h2 id="h-admins">Admins</h2>
      <p class="muted" style="margin:0">Only these email addresses can log in to the admin. A new admin opens the log-in page and chooses “First time here? Create your password”.</p>
      <div class="list" data-admins></div>
      <div class="row"><label class="field"><span>Add an admin by email</span><input type="email" data-new placeholder="name@example.org"></label><button type="button" class="btn" data-add>Add</button></div>
    </section>
  </div>`);
const $ = q => main.querySelector(q);
let list = admins || [];
function draw() {
  $('[data-admins]').innerHTML = list.map(a => `<div><span class="grow">${esc(a.email)}${a.email === user.email ? ' <span class="muted">(you)</span>' : ''}</span>${a.email === user.email ? '' : `<button type="button" class="btn btn--small btn--quiet" data-rm="${esc(a.email)}">Remove</button>`}</div>`).join('');
  main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(`Remove ${b.dataset.rm} from the admins?`)) return;
    const { error } = await sb.from('admins').delete().eq('email', b.dataset.rm);
    if (error) return toast(errMsg(error), true);
    list = list.filter(a => a.email !== b.dataset.rm); draw(); toast('Admin removed.');
  }));
}
draw();
$('[data-add]').addEventListener('click', async () => {
  const email = $('[data-new]').value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Enter a valid email address.', true);
  const { error } = await sb.from('admins').insert({ email });
  if (error) return toast(errMsg(error), true);
  list.push({ email }); list.sort((a, b) => a.email.localeCompare(b.email)); $('[data-new]').value = ''; draw(); toast('Admin added.');
});
$('[data-savesite]').addEventListener('click', async () => {
  const { error } = await sb.from('site_settings').update({ site_name: $('[data-name]').value.trim() || 'Grassroot Archives', contact_email: $('[data-email]').value.trim() || null }).eq('id', 1);
  error ? toast(errMsg(error), true) : toast('Settings saved.');
});
