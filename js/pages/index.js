    // ── Settings modal ─────────────────────────────────────────────────────────
    const CAT_LABELS = { milktea:"Milk Tea", fruittea:"Fruit Tea", icedcoffee:"Iced Coffee", hotcoffee:"Hot Coffee" };
    let _ws = null;

    function openSettings() {
      _ws = JSON.parse(JSON.stringify(getSettings()));
      renderSettingsModal();
      document.getElementById("settingsModal").classList.add("open");
    }
    function closeSettings() { document.getElementById("settingsModal").classList.remove("open"); }
    function handleSettingsOverlay(e) { if (e.target === document.getElementById("settingsModal")) closeSettings(); }

    // Deep link from another page's Settings icon (see header.js: goToSettings())
    if (new URLSearchParams(location.search).get("settings") === "1") {
      openSettings();
      history.replaceState(null, "", location.pathname);
    }

    async function confirmResetSettings() {
      if (getDeviceRole() !== "manager") return;
      const ok = await BrewsDialog.confirm("Reset all settings to defaults? This cannot be undone.", { okLabel: "Reset", danger: true });
      if (!ok) return;
      resetSettings(); _ws = JSON.parse(JSON.stringify(getSettings())); renderSettingsModal();
    }

    function saveAndCloseSettings() {
      if (getDeviceRole() === "manager") { collectFromUI(); saveSettings(_ws); }
      closeSettings(); updateSyncCard();
    }

    function setLocalRole(role) {
      setDeviceRole(role); renderSettingsModal(); updateSyncCard();
      // Re-apply role UI without full reload
      const isManager = role === "manager";
      const nav     = document.getElementById("bottomNav");
      const resume  = document.getElementById("resumeBanner");
      const viewHist= document.getElementById("viewHistoryBtn");
      const roleSub = document.getElementById("homeRoleSub");

      if (nav) {
        nav.outerHTML = renderBottomNav(isManager ? "home" : "", {
          navId: "bottomNav",
          variant: isManager ? "manager" : "worker"
        });
        applyBottomNavRole();
      }
      if (isManager) {
        if (resume)   resume.style.display = "none";
        if (viewHist) viewHist.style.display = "flex";
        if (roleSub)  roleSub.textContent = "Manager View";
      } else {
        if (resume && localStorage.getItem("brewsResumeShift")) resume.style.display = "flex";
        if (viewHist) viewHist.style.display = "none";
        if (roleSub)  roleSub.textContent = "Inventory System";
      }
    }

    function n(id) { return parseFloat(document.getElementById(id)?.value) || 0; }

    function collectFromUI() {
      _ws.prices = { M:n("sp_M"),L:n("sp_L"),S:n("sp_S"),MC:n("sp_MC"),LC:n("sp_LC"),HC:n("sp_HC"),FTM:n("sp_FTM"),FTL:n("sp_FTL") };
      _ws.addonPrices = {};
      document.querySelectorAll(".saddon-row").forEach(r => {
        const name = r.querySelector(".saddon-name")?.value?.trim();
        const price = parseFloat(r.querySelector(".saddon-price")?.value) || 0;
        if (name) _ws.addonPrices[name] = price;
      });
      _ws.salaryBase           = n("sp_salaryBase");
      _ws.salaryBonusThreshold = n("sp_bonusThreshold");
      _ws.salaryBonusPerK      = n("sp_bonusPerK");
      _ws.quotaStart           = n("sp_quotaStart");
      _ws.lowStock             = n("sp_lowStock");
      const sndEl = document.getElementById("sp_sound");
      if (sndEl) _ws.soundEnabled = sndEl.checked;
    }

    function addFlavorToCategory(cat) {
      if (getDeviceRole() !== "manager") return;
      const input = document.getElementById("sfi_" + cat);
      const val   = input?.value?.trim();
      if (!val) return;
      if (!_ws.flavors[cat]) _ws.flavors[cat] = [];
      if (!_ws.flavors[cat].includes(val)) { _ws.flavors[cat].push(val); renderFlavorCat(cat); }
      input.value = "";
    }

    function removeFlavorFromCategory(cat, flavor) {
      if (getDeviceRole() !== "manager") return;
      _ws.flavors[cat] = (_ws.flavors[cat] || []).filter(f => f !== flavor);
      renderFlavorCat(cat);
    }

    function renderFlavorCat(cat) {
      const c = document.getElementById("sfcat_" + cat);
      if (!c) return;
      const isManager = getDeviceRole() === "manager";
      const flavors = _ws.flavors[cat] || [];
      c.querySelector(".sflavor-pills").innerHTML = flavors.length
        ? flavors.map(f => `<span class="sflavor-pill">${f}${isManager
            ? `<button class="sflavor-pill-del" onclick="removeFlavorFromCategory('${cat}','${f.replace(/'/g,"\\'")}')">✕</button>`
            : ""}</span>`).join("")
        : `<span style="font-size:0.76rem;color:var(--mochaccino);">No flavors added</span>`;
    }

    function fi(id, label, val, locked) {
      return `<div class="smodal-field"><label class="smodal-label">${label}</label>
        <input class="smodal-input" id="${id}" type="number" value="${val}"${locked?" disabled":""}></div>`;
    }

    function renderSettingsModal() {
      const s = _ws, role = getDeviceRole(), isManager = role === "manager", locked = !isManager;

      document.getElementById("smodal-save-btn").style.display  = isManager ? "" : "none";
      document.getElementById("smodal-reset-btn").style.display = isManager ? "" : "none";

      const roleSection = `
        <div class="smodal-section">
          <div class="smodal-section-title">Device Role</div>
          <div class="role-toggle">
            <button class="role-btn${!isManager?" active":""}" onclick="setLocalRole('worker')">👷 Worker</button>
            <button class="role-btn${isManager?" active":""}"  onclick="setLocalRole('manager')">👔 Manager</button>
          </div>
          <div class="role-notice ${role}">
            ${isManager
              ? "✓ <strong>Manager mode</strong> — You can edit all settings. Push sends prices, salary &amp; flavors to all devices. You only see Calendar &amp; History."
              : "👷 <strong>Worker mode</strong> — Settings are view-only. Push sends shift data (history &amp; orders) to the cloud."}
          </div>
        </div>`;

      const lockedBanner = locked ? `<div class="settings-locked-banner">🔒 Settings are managed by the Manager device.<br>Switch to Manager mode above to make changes.</div>` : "";

      const themeSection = `
        <div class="smodal-section">
          <div class="smodal-section-title">🎨 Theme (this device)</div>
          <div class="theme-section">
            <div class="theme-label">Accent Color</div>
            <div class="theme-color-row">
              <input type="color" id="themeColorInput" value="#C4813A" oninput="onThemeColorChange(this.value)">
              <div class="theme-swatches" id="themeSwatches"></div>
            </div>
            <button type="button" class="theme-text-btn" onclick="resetThemeAccent()">Reset to default caramel</button>
          </div>
          <div class="theme-section" style="margin-bottom:0;">
            <div class="theme-label">Background Photo</div>
            <input type="file" accept="image/*" id="themeBgInput" style="display:none;" onchange="onThemeBgSelected(this.files[0])">
            <div style="display:flex;gap:8px;">
              <button type="button" class="theme-upload-btn" onclick="document.getElementById('themeBgInput').click()">📷 Choose Photo</button>
              <button type="button" class="theme-text-btn" id="themeBgClearBtn" style="display:none;flex-shrink:0;" onclick="clearThemeBg()">Remove</button>
            </div>
            <div id="themeBgPreviewWrap" style="display:none;margin-top:10px;">
              <img id="themeBgPreview" alt="Preview of your selected background photo" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--radius-md);border:1.5px solid var(--latte);">
            </div>
            <div style="font-size:0.72rem;color:var(--dust);margin-top:8px;line-height:1.5;">Saved per device — applies across POS, Inventory &amp; Calendar. Not affected by Worker/Manager lock.</div>
          </div>
        </div>`;


      const addonRows = Object.entries(s.addonPrices).map(([name, price]) => `
        <div class="expense-row saddon-row">
          <input class="smodal-input saddon-name"  type="text"   value="${name}"  placeholder="Add-on name"${locked?" disabled":""}>
          <input class="smodal-input saddon-price" type="number" value="${price}" placeholder="₱0"${locked?" disabled":""}>
          ${!locked?`<button type="button" onclick="this.parentElement.remove();">✕</button>`:""}
        </div>`).join("");

      const addAddonBtn = !locked ? `<button class="add-expense-btn" style="margin-top:8px;"
        onclick="document.getElementById('saddonContainer').insertAdjacentHTML('beforeend',
          \`<div class='expense-row saddon-row'>
            <input class='smodal-input saddon-name' type='text' placeholder='Add-on name'>
            <input class='smodal-input saddon-price' type='number' placeholder='₱0'>
            <button type='button' onclick='this.parentElement.remove();'>✕</button>
          </div>\`);">+ Add Add-on</button>` : "";

      const flavorHTML = Object.entries(CAT_LABELS).map(([cat, label]) => `
        <div class="sflavor-cat" id="sfcat_${cat}">
          <div class="sflavor-cat-title">${label}</div>
          <div class="sflavor-pills"></div>
          ${!locked?`<div class="sflavor-add-row" style="margin-top:6px;">
            <input class="sflavor-add-input" id="sfi_${cat}" type="text" placeholder="Add flavor…"
              onkeydown="if(event.key==='Enter'){addFlavorToCategory('${cat}');event.preventDefault();}">
            <button class="sflavor-add-btn" onclick="addFlavorToCategory('${cat}')">+ Add</button>
          </div>`:""}
        </div>`).join("");

      document.getElementById("settingsBody").innerHTML = themeSection + roleSection + lockedBanner + `
        <div class="smodal-section">
          <div class="smodal-section-title">Drink Prices (₱)</div>
          <div class="smodal-grid">
            ${fi("sp_M","Milktea M",s.prices.M,locked)}${fi("sp_L","Milktea L",s.prices.L,locked)}
            ${fi("sp_S","Milktea S",s.prices.S,locked)}${fi("sp_MC","Iced Coffee M",s.prices.MC,locked)}
            ${fi("sp_LC","Iced Coffee L",s.prices.LC,locked)}${fi("sp_HC","Hot Coffee",s.prices.HC,locked)}
            ${fi("sp_FTM","Fruit Tea M",s.prices.FTM,locked)}${fi("sp_FTL","Fruit Tea L",s.prices.FTL,locked)}
          </div>
        </div>
        <div class="smodal-section">
          <div class="smodal-section-title">Add-on Prices (₱)</div>
          <div id="saddonContainer">${addonRows}</div>${addAddonBtn}
        </div>
        <div class="smodal-section">
          <div class="smodal-section-title">Salary &amp; Bonus</div>
          <div class="smodal-grid-3">
            ${fi("sp_salaryBase","Base Salary (₱)",s.salaryBase,locked)}
            ${fi("sp_bonusThreshold","Bonus Threshold (₱)",s.salaryBonusThreshold,locked)}
            ${fi("sp_bonusPerK","Bonus per ₱1,000 (₱)",s.salaryBonusPerK,locked)}
          </div>
          <div style="font-size:0.72rem;color:var(--dust);margin-top:8px;line-height:1.5;">Staff earns the base salary when cup sales meet or exceed it. Once sales hit the bonus threshold, the bonus kicks in — plus that same amount for every extra ₱1,000.</div>
        </div>
        <div class="smodal-section">
          <div class="smodal-section-title">Quota &amp; Low Stock</div>
          <div class="smodal-grid">
            ${fi("sp_quotaStart","Quota Toast at (₱)",s.quotaStart,locked)}
            ${fi("sp_lowStock","Low Stock Warning (cups)",s.lowStock,locked)}
          </div>
        </div>
        <div class="smodal-section">
          <div class="smodal-section-title">POS Sound</div>
          <label style="display:flex;align-items:center;gap:10px;cursor:${locked?'default':'pointer'};padding:4px 0;">
            <input type="checkbox" id="sp_sound" ${s.soundEnabled?"checked":""} ${locked?"disabled":""}
              style="width:18px;height:18px;accent-color:var(--caramel);cursor:${locked?'default':'pointer'};">
            <span style="font-size:0.84rem;color:var(--roast);font-weight:600;">Enable order sounds</span>
            <span style="font-size:0.76rem;color:var(--bark);margin-left:2px;">🔔</span>
          </label>
          <div style="font-size:0.72rem;color:var(--bark);margin-top:6px;line-height:1.5;">Subtle tap on item add, soft bell on order placed, rising chime on quota hit.</div>
        </div>
        <div class="smodal-section">
          <div class="smodal-section-title">Flavors</div>
          ${locked?`<div style="font-size:0.76rem;color:var(--dust);margin-bottom:12px;">Managed by the Manager device.</div>`
                  :`<div style="font-size:0.76rem;color:var(--bark);margin-bottom:12px;">Add or remove flavors per drink category.</div>`}
          ${flavorHTML}
        </div>`;

      Object.keys(CAT_LABELS).forEach(cat => renderFlavorCat(cat));
      renderThemeSection();
    }

    // ── Theme (accent color + background photo) ──────────────────────────────
    const THEME_SWATCHES = ["#C4813A","#4A90D9","#4AA88A","#D46A9E","#7C6FD4","#D45A5A","#3D3D3D","#2E8B8B"];

    function renderThemeSection() {
      document.getElementById("themeColorInput").value = window.BrewsTheme.getAccent();
      renderThemeSwatches();
      updateThemeBgUI();
    }

    function renderThemeSwatches() {
      const current = window.BrewsTheme.getAccent().toLowerCase();
      const wrap = document.getElementById("themeSwatches");
      wrap.innerHTML = THEME_SWATCHES.map(c => `
        <button type="button" class="theme-swatch${c.toLowerCase()===current?" active":""}"
          style="background:${c};" onclick="onThemeColorChange('${c}')"
          aria-label="Set accent color ${c}" aria-pressed="${c.toLowerCase()===current}"></button>
      `).join("");
    }

    function onThemeColorChange(hex) {
      window.BrewsTheme.setAccent(hex);
      document.getElementById("themeColorInput").value = hex;
      renderThemeSwatches();
    }

    function resetThemeAccent() {
      window.BrewsTheme.resetAccent();
      document.getElementById("themeColorInput").value = window.BrewsTheme.BASE.caramel;
      renderThemeSwatches();
    }

    function updateThemeBgUI() {
      const bg       = window.BrewsTheme.getBackground();
      const clearBtn = document.getElementById("themeBgClearBtn");
      const wrap     = document.getElementById("themeBgPreviewWrap");
      const preview  = document.getElementById("themeBgPreview");
      if (bg) {
        clearBtn.style.display = "block";
        wrap.style.display     = "block";
        preview.src            = bg;
      } else {
        clearBtn.style.display = "none";
        wrap.style.display     = "none";
        preview.src            = "";
      }
    }

    // Resizes/compresses the chosen photo client-side before storing it
    // (localStorage has a low size ceiling, and a phone photo straight off
    // the camera would blow way past it).
    function onThemeBgSelected(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1280;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const scale = MAX / Math.max(width, height);
            width  = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
          try {
            window.BrewsTheme.setBackground(dataUrl);
            updateThemeBgUI();
          } catch (err) {
            BrewsDialog.alert("That photo was too large to save. Try a smaller image.");
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    function clearThemeBg() {
      window.BrewsTheme.clearBackground();
      updateThemeBgUI();
    }
