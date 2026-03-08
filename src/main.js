import { createClient } from '@supabase/supabase-js'
import { Html5Qrcode } from 'html5-qrcode'
import './style.css'

// Initialiser Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// État de l'application
let currentUser = null
let currentFamilies = []
let activeFamilyId = null
let familyMembersSubscription = null
let html5QrCode = null
let isProcessingScan = false // Empêche les scans multiples simultanés
let currentAuthMode = 'login' // 'login' ou 'signup'

// Vérification manuelle du jeton de récupération dans l'URL (pour GitHub Pages / redirection query params)
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.get('type') === 'recovery' || window.location.hash.includes('type=recovery')) {
  console.log("Flux de récupération détecté via URL")
  currentAuthMode = 'update-password'
}

// Éléments DOM Auth
const authSection = document.getElementById('auth-section')
const mainSection = document.getElementById('main-section')
const authForm = document.getElementById('auth-form')
const firstNameContainer = document.getElementById('first-name-container')
const firstNameInput = document.getElementById('first-name')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const authError = document.getElementById('auth-error')
const authTitle = document.getElementById('auth-title')
const authSubtitle = document.getElementById('auth-subtitle')
const authSubmitBtn = document.getElementById('auth-submit-btn')
const authToggleBtn = document.getElementById('auth-toggle-btn')
const logoutBtn = document.getElementById('logout-btn')
const forgotPasswordBtn = document.getElementById('forgot-password-btn')
const passwordContainer = document.getElementById('password-container')

// Éléments DOM Vues et Navigation
const viewList = document.getElementById('view-list')
const viewShopping = document.getElementById('view-shopping')
const viewProfile = document.getElementById('view-profile')

const navList = document.getElementById('nav-list')
const navShopping = document.getElementById('nav-shopping')
const navProfile = document.getElementById('nav-profile')

const views = [
  { view: viewList, nav: navList },
  { view: viewShopping, nav: navShopping },
  { view: viewProfile, nav: navProfile }
]

// Éléments Liste de Courses (Vue 1)
const familySelect = document.getElementById('family-select')
const addItemForm = document.getElementById('add-item-form')
const newItemInput = document.getElementById('new-item-input')
const newItemQuantity = document.getElementById('new-item-quantity')
const shoppingList = document.getElementById('shopping-list')
const itemTemplate = document.getElementById('item-template')
const listCount = document.getElementById('list-count')
const suggestionsContainer = document.getElementById('suggestions-container')
let allFamilyItemNames = []
const templateSelect = document.getElementById('template-select')
const applyTemplateBtn = document.getElementById('apply-template-btn')
const deleteTemplateBtn = document.getElementById('delete-template-btn')
const saveTemplateBtn = document.getElementById('save-template-btn')

// Éléments Scanner
const scanBtn = document.getElementById('scan-btn')
const scannerContainer = document.getElementById('scanner-container')
const closeScannerBtn = document.getElementById('close-scanner-btn')
const scannerStatus = document.getElementById('scanner-status')

const qrConfig = { fps: 10, qrbox: { width: 250, height: 150 } }

// Éléments Mode Courses (Vue 2)
const shoppingModeList = document.getElementById('shopping-mode-list')
const shoppingItemTemplate = document.getElementById('shopping-item-template')
const shoppingProgressText = document.getElementById('shopping-progress-text')
const shoppingCountText = document.getElementById('shopping-count-text')
const shoppingProgressBar = document.getElementById('shopping-progress-bar')
const clearCompletedBtn = document.getElementById('clear-completed-btn')

// Éléments Profil & Famille (Vue 3)
const profileEmail = document.getElementById('profile-email')
const profileRole = document.getElementById('profile-role')
const profileFamilyName = document.getElementById('profile-family-name')
const familyMemberCount = document.getElementById('family-member-count')
const membersList = document.getElementById('members-list')
const ownerActions = document.getElementById('owner-actions')
const inviteForm = document.getElementById('invite-form')
const inviteEmail = document.getElementById('invite-email')
const inviteMsg = document.getElementById('invite-msg')

const invitationsSectionList = document.getElementById('invitations-section-list')
const invitationsListList = document.getElementById('invitations-list-list')
const invitationsSectionProfile = document.getElementById('invitations-section-profile')
const invitationsListProfile = document.getElementById('invitations-list-profile')

const profileForm = document.getElementById('profile-form')
const profileFirstNameInput = document.getElementById('profile-first-name')
const profileMsg = document.getElementById('profile-msg')
const sentInvitationsContainer = document.getElementById('sent-invitations-container')
const sentInvitationsList = document.getElementById('sent-invitations-list')
const createFamilyForm = document.getElementById('create-family-form')
const newFamilyName = document.getElementById('new-family-name')
const createFamilyMsg = document.getElementById('create-family-msg')


// --- Initialisation ---

async function init() {
  const { data: { session } } = await supabase.auth.getSession()

  supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthStateChange(session)
  })

  handleAuthStateChange(session)
  checkAuthErrors()
  setupEventListeners()
}

/**
 * Vérifie si des erreurs d'authentification sont présentes dans le fragment URL (#error=...)
 * Cela arrive lors d'une redirection après un lien de confirmation expiré ou invalide.
 */
function checkAuthErrors() {
  const hash = window.location.hash
  if (hash && hash.includes('error=')) {
    // Transformer le fragment en paramètres lisibles
    const params = new URLSearchParams(hash.substring(1)) // Retirer le '#'
    const errorMsg = params.get('error_description') || params.get('error')

    if (errorMsg) {
      authError.textContent = decodeURIComponent(errorMsg).replace(/\+/g, ' ')
      authError.classList.remove('hidden')
      // Nettoyer l'URL pour éviter de ré-afficher l'erreur au rafraîchissement
      window.history.replaceState(null, null, window.location.pathname)
    }
  }
}

// --- Navigation entre les vues ---
function switchView(targetViewId) {
  views.forEach(({ view, nav }) => {
    if (view.id === targetViewId) {
      view.classList.remove('hidden')
      view.classList.add('flex')
      nav.classList.add('text-primary')
      nav.classList.remove('text-slate-400', 'dark:text-slate-600')
      // Fill the icon
      nav.querySelector('span').classList.add('fill-current')
    } else {
      view.classList.add('hidden')
      view.classList.remove('flex')
      nav.classList.remove('text-primary')
      nav.classList.add('text-slate-400', 'dark:text-slate-600')
      nav.querySelector('span').classList.remove('fill-current')
    }
  })
}


// --- Authentification ---

function handleAuthStateChange(session) {
  currentUser = session?.user || null

  if (currentUser) {
    authSection.classList.add('hidden')
    mainSection.classList.remove('hidden')
    profileEmail.textContent = currentUser.email
    switchView('view-list') // Vue par défaut
    loadFamilies()
    loadInvitations()
    setupRealtimeSubscription()
  } else {
    if (familyMembersSubscription) {
      supabase.removeChannel(familyMembersSubscription)
      familyMembersSubscription = null
    }
    authSection.classList.remove('hidden')
    mainSection.classList.add('hidden')
    // S'assurer de cacher les vues principales
    views.forEach(({ view }) => view.classList.add('hidden'))
  }
}

function setupRealtimeSubscription() {
  if (!currentUser) return

  const channelName = `family-updates-${currentUser.id.substring(0, 8)}`
  console.log(`Initialisation de la souscription temps réel: ${channelName}`)

  if (familyMembersSubscription) {
    console.log("Suppression de l'ancienne souscription...")
    supabase.removeChannel(familyMembersSubscription)
  }

  familyMembersSubscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'family_members'
      },
      (payload) => {
        console.log('Changement détecté dans family_members:', payload.eventType)
        loadInvitations()
        loadFamilies()
        loadFamilyMembers()
      }
    )
    .subscribe((status) => {
      console.log(`Statut de la souscription temps réel: ${status}`)
    })
}

async function handleAuthSubmit(e) {
  e.preventDefault()
  authError.classList.add('hidden')
  authSubmitBtn.disabled = true
  authSubmitBtn.textContent = 'Chargement...'

  const email = emailInput.value
  const password = passwordInput.value
  const firstName = firstNameInput.value.trim()

  let result
  if (currentAuthMode === 'login') {
    result = await supabase.auth.signInWithPassword({ email, password })
  } else if (currentAuthMode === 'signup') {
    // Construction explicite de l'URL de redirection pour GitHub Pages
    const redirectTo = window.location.origin + window.location.pathname
    console.log("Tentative d'inscription avec redirection vers :", redirectTo)

    result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        redirectTo: redirectTo,
        data: {
          first_name: firstName || 'Utilisateur'
        }
      }
    })
  } else if (currentAuthMode === 'forgot-password') {
    const redirectTo = window.location.origin + window.location.pathname
    result = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  } else if (currentAuthMode === 'update-password') {
    result = await supabase.auth.updateUser({ password })
  }

  const { data, error } = result
  authSubmitBtn.disabled = false
  authSubmitBtn.textContent = currentAuthMode === 'login' ? 'Se connecter' : 'S\'inscrire'

  if (error) {
    let msg = error.message
    if (msg.includes('Invalid login credentials')) {
      msg = 'Email ou mot de passe incorrect.'
    } else if (msg.includes('User already registered')) {
      msg = 'Cet email est déjà utilisé.'
    } else if (msg.includes('Password should be')) {
      msg = 'Le mot de passe doit faire au moins 6 caractères.'
    } else if (msg.includes('Email rate limit exceeded')) {
      msg = 'Trop de tentatives en peu de temps. Merci de patienter quelques minutes.'
    }
    authError.textContent = msg
    authError.classList.remove('hidden')
  } else if (currentAuthMode === 'signup' && data.user && !data.session) {
    alert("Compte créé ! Merci de vérifier tes emails pour valider ton compte avant de te connecter.")
    toggleAuthMode()
  } else if (currentAuthMode === 'forgot-password') {
    alert("Email de réinitialisation envoyé ! Vérifie ta boîte mail.")
    currentAuthMode = 'login'
    toggleAuthMode()
  } else if (currentAuthMode === 'update-password') {
    alert("Mot de passe mis à jour avec succès !")
    currentAuthMode = 'login'
    toggleAuthMode()
  }
}

function toggleAuthMode(forcedMode) {
  if (forcedMode) {
    currentAuthMode = forcedMode
  } else {
    if (currentAuthMode === 'login') currentAuthMode = 'signup'
    else if (currentAuthMode === 'signup') currentAuthMode = 'login'
    else currentAuthMode = 'login'
  }

  authError.classList.add('hidden')
  firstNameContainer.classList.add('hidden')
  passwordContainer.classList.remove('hidden')
  emailInput.closest('div').classList.remove('hidden')
  authToggleBtn.classList.remove('hidden')
  firstNameInput.required = false
  emailInput.required = true
  passwordInput.required = true

  if (currentAuthMode === 'signup') {
    authTitle.textContent = "Rejoindre Family Cart"
    authSubtitle.textContent = "Créez votre compte pour commencer"
    authSubmitBtn.textContent = "S'inscrire"
    authToggleBtn.textContent = "Déjà un compte ? Se connecter"
    firstNameContainer.classList.remove('hidden')
    firstNameInput.required = true
    forgotPasswordBtn.classList.add('hidden')
  } else if (currentAuthMode === 'login') {
    authTitle.textContent = "Family Cart"
    authSubtitle.textContent = "Gérez vos listes ensemble"
    authSubmitBtn.textContent = "Se connecter"
    authToggleBtn.textContent = "Pas de compte ? Créer un compte"
    forgotPasswordBtn.classList.remove('hidden')
  } else if (currentAuthMode === 'forgot-password') {
    authTitle.textContent = "Réinitialisation"
    authSubtitle.textContent = "Saisis ton email pour recevoir un lien"
    authSubmitBtn.textContent = "Envoyer le lien"
    authToggleBtn.textContent = "Retour à la connexion"
    passwordContainer.classList.add('hidden')
    passwordInput.required = false
    forgotPasswordBtn.classList.add('hidden')
  } else if (currentAuthMode === 'update-password') {
    authTitle.textContent = "Nouveau mot de passe"
    authSubtitle.textContent = "Choisis ton nouveau mot de passe"
    authSubmitBtn.textContent = "Mettre à jour"
    authToggleBtn.classList.add('hidden')
    emailInput.closest('div').classList.add('hidden')
    emailInput.required = false
    forgotPasswordBtn.classList.add('hidden')
  }
}

forgotPasswordBtn.addEventListener('click', () => toggleAuthMode('forgot-password'))

// Écouter les changements d'état d'auth (pour la récupération de mot de passe)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    console.log("Événement PASSWORD_RECOVERY détecté")
    toggleAuthMode('update-password')
  } else if (event === 'SIGNED_IN') {
    handleAuthStateChange(session)
  } else if (event === 'SIGNED_OUT') {
    handleAuthStateChange(null)
  }
})

async function handleLogout() {
  await supabase.auth.signOut()
}

// --- Familles ---

let retries = 0
const maxRetries = 5

async function loadFamilies() {
  const { data, error } = await supabase
    .from('families')
    .select('*, family_members!inner(role, status)')
    .eq('family_members.user_id', currentUser.id)
    .eq('family_members.status', 'accepted')

  if (error) {
    console.error('Erreur lors du chargement des familles', error)
    shoppingList.innerHTML = '<li class="p-6 text-center text-red-500 font-medium">Erreur de connexion. Réessayez plus tard.</li>'
    return
  }

  currentFamilies = data || []

  if (currentFamilies.length === 0) {
    activeFamilyId = null
    shoppingList.innerHTML = '<li class="p-6 text-center text-slate-400 font-medium italic">Aucune famille trouvée.</li>'
    shoppingModeList.innerHTML = shoppingList.innerHTML
    updateProfileFamilyView()
    return
  }

  familySelect.innerHTML = currentFamilies.map(f =>
    `<option value="${f.id}">${f.name}</option>`
  ).join('')

  if (currentFamilies.length > 0) {
    activeFamilyId = currentFamilies[0].id
    familySelect.value = activeFamilyId
    loadShoppingItems()
    updateProfileFamilyView()
    loadSuggestions()
    loadTemplates()
  }
}

familySelect.addEventListener('change', (e) => {
  activeFamilyId = e.target.value
  loadShoppingItems()
  updateProfileFamilyView()
  loadTemplates()
  loadSuggestions()
})

async function handleCreateFamily(e) {
  e.preventDefault()
  const name = newFamilyName.value.trim()
  if (!name || !currentUser) return

  createFamilyMsg.classList.remove('hidden')
  createFamilyMsg.textContent = 'Création en cours...'
  createFamilyMsg.className = 'text-xs mt-2 text-primary'

  try {
    // Utiliser le RPC pour une création atomique (évite les problèmes de RLS sur le SELECT immédiat)
    const { data: familyId, error } = await supabase.rpc('create_family_with_owner', {
      p_name: name
    })

    if (error) throw error

    createFamilyMsg.textContent = 'Famille créée avec succès !'
    createFamilyMsg.className = 'text-xs mt-2 text-primary font-bold'
    newFamilyName.value = ''

    // 3. Recharger
    loadFamilies()

  } catch (err) {
    console.error('Erreur creation famille', err)
    createFamilyMsg.textContent = 'Erreur lors de la création.'
    createFamilyMsg.className = 'text-xs mt-2 text-red-500'
  }
}


// --- Profil & Gestion Famille (Vue 3) ---

async function updateProfileFamilyView() {
  const activeFamily = currentFamilies.find(f => f.id === activeFamilyId)

  if (!activeFamily) {
    profileFamilyName.textContent = "Aucune famille"
    profileRole.textContent = "-"
    ownerActions.classList.add('hidden')
  } else {
    profileFamilyName.textContent = activeFamily.name
    // Vérifier si l'utilisateur est propriétaire
    const myMember = activeFamily.family_members.find(m => true)
    const role = myMember ? myMember.role : 'member'
    profileRole.textContent = role === 'owner' ? 'Propriétaire' : 'Membre'
    if (role === 'owner') {
      ownerActions.classList.remove('hidden')
    } else {
    }
  }

  // Charger le profil de l'utilisateur actuel pour le formulaire
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', currentUser.id)
    .single()

  if (profile) {
    profileFirstNameInput.value = profile.first_name
  }

  inviteMsg.classList.add('hidden')
  profileMsg.classList.add('hidden')
  await loadFamilyMembers()
}

async function loadFamilyMembers() {
  if (!activeFamilyId) {
    membersList.innerHTML = '<li class="p-4 text-center text-slate-400 italic">Aucun membre.</li>'
    familyMemberCount.textContent = '0 Membre'
    sentInvitationsContainer.classList.add('hidden')
    return
  }

  const { data, error } = await supabase
    .from('family_members')
    .select(`
      user_id, 
      role,
      status,
      profiles (
        first_name
      )
    `)
    .eq('family_id', activeFamilyId)

  if (error) {
    console.error('Erreur membres', error)
    return
  }

  const acceptedMembers = data.filter(m => m.status === 'accepted')
  const pendingMembers = data.filter(m => m.status === 'pending')

  familyMemberCount.textContent = `${acceptedMembers.length} Membre${acceptedMembers.length > 1 ? 's' : ''}`

  const isOwner = data.find(m => m.user_id === currentUser.id)?.role === 'owner'

  // Afficher les membres acceptés
  membersList.innerHTML = acceptedMembers.map(m => {
    const isMe = m.user_id === currentUser.id
    const firstName = m.profiles ? m.profiles.first_name : null

    let displayName = 'Membre (' + m.user_id.substring(0, 6) + '...)'
    if (isMe) displayName = 'Vous' + (firstName ? ` (${firstName})` : '')
    else if (firstName) displayName = firstName

    const avatar = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlRNUWArXF3aibHSDkdlM4k_NA8ruaGZ5eWwCeYhRdO1Q7hXPN7HSGByo4meLJdtlZ6RMvny5_b-TdJXnuM23F8OEQqqNrphw302FXyo_6e56pRT4Eg4S4JXDDAg7bGDXsy2vjIPz_cNk5sApr_46KZAagDFa4fmI6UEoAb_tx-7DUG2urCUqQG6Zl86t5qFCdeue4fRA8BbeT1v15Tzni8W94EhfUiRyzl4ErlHGxApSdL8x37U1BPRy9hMYYJ3t6b1fLpzxjUS8'

    return `
      <li class="flex items-center gap-4 py-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <img alt="Membre" class="w-10 h-10 rounded-full object-cover" src="${isMe ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuDlHpcljmtsN_fW-1my03yBu9MzDR-J8LVpSoBRx9ufvZ8lzJ4Ahru48elZ0-Q85oZStJpxwev2_JmgK5DBgusBdoE_l-mNaWT_vcQGrZeoS6rqIk6UUAbA-ZYa7LjBZZiOke-vLLDg9BG6fdm6xrmooZzgAPegLmQ4iWTSwca3GuwgDQVh1XhHiz9vjPj17zTS5LJnZZqozoyxsYAggz3k54U1szQA6t75w7ptlmDEOqvvtcYQR-QG9YPZk0HS-y1pXm5b-VSPoz4' : avatar}"/>
        <div class="flex-1">
          <p class="font-semibold text-slate-900 dark:text-slate-100">${displayName}</p>
          <p class="text-xs text-slate-500">${m.role === 'owner' ? 'Propriétaire' : 'Membre'}</p>
        </div>
        ${isOwner && !isMe ? `
          <button onclick="handleRemoveMember('${m.user_id}')" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Supprimer de la famille">
            <span class="material-symbols-outlined text-lg">person_remove</span>
          </button>
        ` : ''}
      </li>
    `
  }).join('')

  // Afficher les invitations envoyées (pour le propriétaire)
  if (isOwner && pendingMembers.length > 0) {
    sentInvitationsContainer.classList.remove('hidden')
    sentInvitationsList.innerHTML = pendingMembers.map(m => {
      const emailHint = m.user_id.substring(0, 8) + '...'
      return `
        <li class="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-amber-500 text-sm">hourglass_empty</span>
            <span class="text-xs font-medium text-slate-600 dark:text-slate-400">En attente...</span>
          </div>
          <button onclick="handleRemoveMember('${m.user_id}')" class="text-xs text-red-500 hover:underline">Annuler</button>
        </li>
      `
    }).join('')
  } else {
    sentInvitationsContainer.classList.add('hidden')
  }
}

window.handleRemoveMember = async (userId) => {
  if (!confirm("Voulez-vous vraiment supprimer ce membre de la famille ?")) return

  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', activeFamilyId)
    .eq('user_id', userId)

  if (error) {
    console.error('Erreur suppression membre', error)
    alert("Impossible de supprimer le membre.")
  } else {
    loadFamilyMembers()
  }
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const firstName = profileFirstNameInput.value.trim()
  if (!firstName) return

  profileMsg.textContent = 'Enregistrement...'
  profileMsg.className = 'text-xs mt-2 text-primary'
  profileMsg.classList.remove('hidden')

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName })
      .eq('id', currentUser.id)

    if (error) throw error

    profileMsg.textContent = 'Prénom mis à jour !'
    profileMsg.className = 'text-xs mt-2 text-green-500 font-bold'

    // Rafraîchir la liste des membres pour voir le changement partout
    loadFamilyMembers()
  } catch (err) {
    console.error('Erreur MAJ profil', err)
    profileMsg.textContent = 'Erreur lors de la mise à jour.'
    profileMsg.className = 'text-xs mt-2 text-red-500'
  }
})

async function loadInvitations() {
  if (!currentUser) return
  console.log('[DEBUG] Chargement des invitations pour:', currentUser.email, currentUser.id)

  const { data, error } = await supabase
    .from('family_members')
    .select('id, family_id, status, families(name)')
    .eq('user_id', currentUser.id)
    .eq('status', 'pending')

  if (error) {
    console.error('[INVITATIONS] Erreur chargement invitations:', error)
    if (invitationsSectionList) invitationsSectionList.classList.add('hidden')
    if (invitationsSectionProfile) invitationsSectionProfile.classList.add('hidden')
    return
  }

  console.log('[INVITATIONS] Données reçues:', data)

  if (!data || data.length === 0) {
    console.log('[INVITATIONS] Aucune invitation en attente.')
    if (invitationsSectionList) invitationsSectionList.classList.add('hidden')
    if (invitationsSectionProfile) invitationsSectionProfile.classList.add('hidden')
    return
  }

  const html = data.map(inv => {
    const familyName = inv.families ? inv.families.name : 'Famille inconnue'
    console.log(`[INVITATIONS] Affichage invitation pour la famille: ${familyName} (${inv.family_id})`)
    return `
      <div class="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
        <div class="flex flex-col">
          <span class="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Invitation</span>
          <span class="text-sm font-bold text-slate-900 dark:text-white">${familyName}</span>
        </div>
        <div class="flex gap-2">
          <button onclick="handleAcceptInvitation('${inv.id}')" class="bg-primary text-background-dark font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95">
            Accepter
          </button>
          <button onclick="handleDeclineInvitation('${inv.id}')" class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95">
            Refuser
          </button>
        </div>
      </div>
    `
  }).join('')

  if (invitationsSectionList) {
    invitationsSectionList.classList.remove('hidden')
    invitationsListList.innerHTML = html
  }
  if (invitationsSectionProfile) {
    invitationsSectionProfile.classList.remove('hidden')
    invitationsListProfile.innerHTML = html
  }
}

window.handleAcceptInvitation = async (invitationId) => {
  const { error } = await supabase
    .from('family_members')
    .update({ status: 'accepted' })
    .eq('id', invitationId)

  if (error) {
    alert("Impossible d'accepter l'invitation.")
  } else {
    loadInvitations()
    loadFamilies()
  }
}

window.handleDeclineInvitation = async (invitationId) => {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', invitationId)

  if (error) {
    alert("Impossible de refuser l'invitation.")
  } else {
    loadInvitations()
  }
}

inviteForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = inviteEmail.value.trim()
  if (!email) return

  console.log("Tentative d'invitation pour:", email)
  inviteMsg.classList.remove('hidden')
  inviteMsg.textContent = 'Invitation en cours...'
  inviteMsg.className = 'text-xs mt-2 text-primary'

  const { data, error } = await supabase.rpc('add_member_by_email', {
    p_email: email,
    p_family_id: activeFamilyId
  })

  if (error) {
    console.error('Erreur invitation:', error)
    if (error.message.includes('déjà membre')) {
      inviteMsg.textContent = 'Cette personne est déjà membre de la famille.'
    } else if (error.message.includes('introuvable')) {
      inviteMsg.textContent = 'Utilisateur introuvable. Verifiez l\'email.'
    } else if (error.message.includes('autorisé')) {
      inviteMsg.textContent = 'Seul le propriétaire peut inviter des membres.'
    } else {
      inviteMsg.textContent = 'Erreur lors de l\'envoi de l\'invitation.'
    }
    inviteMsg.className = 'text-xs mt-2 text-red-500 font-bold'
  } else {
    inviteMsg.textContent = 'Invitation envoyée avec succès !'
    inviteMsg.className = 'text-xs mt-2 text-primary font-bold'
    inviteEmail.value = ''
    loadFamilyMembers()
  }
})


// --- Liste de courses (Vue 1 & Vue 2) ---

async function loadShoppingItems() {
  if (!activeFamilyId) {
    shoppingList.innerHTML = '<li class="p-6 text-center text-slate-400 font-medium italic">Sélectionnez une famille pour voir les articles.</li>'
    shoppingModeList.innerHTML = shoppingList.innerHTML
    return
  }

  const loadingHtml = '<li class="p-6 text-center text-slate-400 font-medium italic animate-pulse">Chargement des articles...</li>'
  shoppingList.innerHTML = loadingHtml
  shoppingModeList.innerHTML = loadingHtml

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('family_id', activeFamilyId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erreur lors du chargement des articles', error)
    return
  }

  renderLists(data)
}

function renderLists(items) {
  shoppingList.innerHTML = ''
  shoppingModeList.innerHTML = ''

  // Calculer le total des quantités
  let totalQty = 0
  let completedQty = 0
  let remainingQty = 0
  let uncompletedRows = 0

  items.forEach(item => {
    const q = parseQuantity(item.quantity)
    const val = q.val !== null ? q.val : 1 // Si pas de nombre, compte comme 1 article
    totalQty += val
    if (item.is_completed) {
      completedQty += val
    } else {
      remainingQty += val
      uncompletedRows++
    }
  })

  // Affichage du compteur : "X articles" (et si quantité > lignes, on précise le total des unités)
  let countText = `${uncompletedRows} article${uncompletedRows > 1 ? 's' : ''}`
  if (remainingQty > uncompletedRows) {
    countText += ` (${remainingQty} au total)`
  }
  listCount.textContent = countText

  const progressPercent = totalQty === 0 ? 0 : Math.round((completedQty / totalQty) * 100)

  shoppingProgressText.textContent = `${progressPercent}%`
  shoppingCountText.textContent = `${completedQty} sur ${totalQty} article${totalQty > 1 ? 's' : ''}`
  shoppingProgressBar.style.width = `${progressPercent}%`


  if (items.length === 0) {
    const emptyHtml = '<li class="p-6 text-center text-slate-400 font-medium italic">Votre liste est vide. Ajoutez quelque chose ! ✨</li>'
    shoppingList.innerHTML = emptyHtml
    shoppingModeList.innerHTML = emptyHtml
    return
  }

  // Rendu Vue 1 (Préparation - On affiche tout)
  items.forEach(item => {
    const clone = itemTemplate.content.cloneNode(true)
    const li = clone.querySelector('li')
    const nameSpan = clone.querySelector('.item-display')
    const deleteBtn = clone.querySelector('.item-delete')
    const iconContainer = clone.querySelector('.item-icon-container')
    const iconSpan = clone.querySelector('.item-icon')

    nameSpan.textContent = item.quantity ? `${item.name} (${item.quantity})` : item.name

    if (item.is_completed) {
      nameSpan.classList.add('line-through', 'text-slate-400', 'dark:text-slate-500')
      iconContainer.classList.remove('border-primary/20', 'bg-background-light')
      iconContainer.classList.add('border-slate-200', 'dark:border-slate-800', 'bg-slate-50', 'dark:bg-slate-900')
      iconSpan.classList.remove('text-primary')
      iconSpan.classList.add('text-slate-400')
    }

    deleteBtn.addEventListener('click', () => deleteItem(item.id))
    shoppingList.appendChild(li)
  })

  // Rendu Vue 2 (Mode Courses - Style avec Checkbox)
  items.forEach(item => {
    const clone = shoppingItemTemplate.content.cloneNode(true)
    const li = clone.querySelector('li')
    const checkbox = clone.querySelector('.item-checkbox')
    const nameSpan = clone.querySelector('.item-display')

    nameSpan.textContent = item.quantity ? `${item.name} (${item.quantity})` : item.name
    checkbox.checked = item.is_completed

    if (item.is_completed) {
      nameSpan.classList.add('line-through', 'text-slate-400', 'dark:text-slate-500')
    }

    checkbox.addEventListener('change', () => toggleItem(item.id, checkbox.checked))

    // Permet de cliquer sur la ligne entière pour cocher
    li.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked
        toggleItem(item.id, checkbox.checked)
      }
    })

    shoppingModeList.appendChild(li)
  })
}

addItemForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = newItemInput.value.trim()
  const quantity = newItemQuantity.value.trim()
  if (!name || !activeFamilyId) return

  await insertItem(name, quantity)
  newItemInput.value = ''
  newItemQuantity.value = ''
  loadSuggestions()
})

async function loadSuggestions() {
  if (!activeFamilyId) return

  const { data, error } = await supabase
    .from('shopping_items')
    .select('name')
    .eq('family_id', activeFamilyId)

  if (error) {
    console.error('Erreur suggestions', error)
    return
  }

  allFamilyItemNames = Array.from(new Set(data.map(item => item.name)))
}

function handleSuggestionInput() {
  const query = newItemInput.value.trim().toLowerCase()
  if (!query || allFamilyItemNames.length === 0) {
    suggestionsContainer.classList.add('hidden')
    return
  }

  const matches = allFamilyItemNames
    .filter(name => name.toLowerCase().includes(query))
    .slice(0, 5)

  if (matches.length === 0) {
    suggestionsContainer.classList.add('hidden')
    return
  }

  // Utiliser mousedown au lieu de click pour éviter que le focus/blur ne ferme le menu avant la sélection
  suggestionsContainer.innerHTML = matches.map(name => `
    <div class="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
         onmousedown="event.preventDefault(); selectSuggestion('${name.replace(/'/g, "\\'")}')">
      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${name}</span>
    </div>
  `).join('')
  suggestionsContainer.classList.remove('hidden')
}

window.selectSuggestion = (name) => {
  newItemInput.value = name
  suggestionsContainer.classList.add('hidden')
  newItemQuantity.focus()
}

function parseQuantity(q) {
  if (!q) return { val: 1, unit: '', isDefault: true }
  const match = q.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (match) return { val: parseFloat(match[1]), unit: match[2].trim(), isDefault: false }
  return { val: null, unit: q.trim(), isDefault: false }
}

async function insertItem(name, quantity = '') {
  const trimmedName = name.trim()
  console.log(`Insertion: ${trimmedName}, Qté: ${quantity}`)

  // Chercher un article similaire (casse, singulier/pluriel en 's')
  const searchName = trimmedName.toLowerCase()
  const singular = searchName.endsWith('s') ? searchName.slice(0, -1) : searchName
  const plural = searchName + 's'

  const { data: familyItems, error: fetchError } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('family_id', activeFamilyId)

  if (fetchError) {
    console.error('Erreur recherche doublons', fetchError)
  }

  const existing = (familyItems || []).find(it => {
    const itName = it.name.trim().toLowerCase()
    return itName === searchName ||
      itName === singular ||
      itName === plural ||
      (itName.endsWith('s') && itName.slice(0, -1) === searchName) ||
      (searchName.endsWith('s') && searchName.slice(0, -1) === itName)
  })

  if (existing) {
    // Calculer la nouvelle quantité par incrémentation
    const oldQty = parseQuantity(existing.quantity)
    const newAddQty = parseQuantity(quantity)

    let updatedQty = quantity || '1'

    // On n'incrémente que si l'article est actif et NON coché
    if (!existing.is_archived && !existing.is_completed) {
      const oldQty = parseQuantity(existing.quantity)
      const newAddQty = parseQuantity(quantity)

      if (oldQty.val !== null && newAddQty.val !== null) {
        // Si les unités sont compatibles (identiques ou la nouvelle est vide)
        if (oldQty.unit === newAddQty.unit || !newAddQty.unit) {
          const sum = oldQty.val + newAddQty.val
          updatedQty = oldQty.unit ? `${sum} ${oldQty.unit}` : `${sum}`
        }
      }
    }
    // Sinon (si c'était archivé ou déjà coché), on repart de la valeur saisie (ou 1)

    const { error } = await supabase
      .from('shopping_items')
      .update({ is_archived: false, is_completed: false, quantity: updatedQty })
      .eq('id', existing.id)

    if (error) console.error('Erreur reactivation', error)
    else loadShoppingItems()
    return
  }

  const { error } = await supabase
    .from('shopping_items')
    .insert([{ name, quantity, family_id: activeFamilyId, is_archived: false }])

  if (error) {
    console.error('Erreur ajout article', error)
  } else {
    loadShoppingItems()
  }
}

async function toggleItem(id, is_completed) {
  const { error } = await supabase
    .from('shopping_items')
    .update({ is_completed })
    .eq('id', id)

  if (error) {
    console.error('Erreur mise à jour article', error)
  } else {
    loadShoppingItems()
  }
}

async function deleteItem(id) {
  // On n'efface plus de la base, on archive
  const { error } = await supabase
    .from('shopping_items')
    .update({ is_archived: true })
    .eq('id', id)

  if (error) {
    console.error('Erreur archivage article', error)
  } else {
    loadShoppingItems()
    loadSuggestions()
  }
}

async function archiveCompletedItems() {
  if (!activeFamilyId) return

  const { error } = await supabase
    .from('shopping_items')
    .update({ is_archived: true })
    .eq('family_id', activeFamilyId)
    .eq('is_completed', true)

  if (error) {
    console.error('Erreur vidage liste', error)
  } else {
    loadShoppingItems()
    loadSuggestions()
  }
}

// --- Scanner de code-barres (OpenFoodFacts) ---

scanBtn.addEventListener('click', async () => {
  if (isProcessingScan) return

  scannerContainer.classList.remove('hidden')
  scannerStatus.textContent = "Vise le code-barres..."

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader")
  }

  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      qrConfig,
      onScanSuccess,
      onScanFailure
    )
  } catch (err) {
    console.error("Erreur scanner start", err)
    alert("Erreur d'accès à la caméra. Vérifiez vos permissions.")
    scannerContainer.classList.add('hidden')
  }
})

closeScannerBtn.addEventListener('click', stopScanner)

async function stopScanner() {
  if (html5QrCode) {
    try {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop()
      }
      // Re-créer l'instance à chaque fois peut aider sur certains navigateurs mobiles
      html5QrCode = null
    } catch (err) {
      console.warn("Erreur lors de l'arrêt du scanner", err)
    }
  }
  scannerContainer.classList.add('hidden')
}

function onScanFailure(error) {
  // Silent ignore
}

async function onScanSuccess(decodedText) {
  if (isProcessingScan) return
  isProcessingScan = true

  // Retour haptique (vibration)
  if (navigator.vibrate) {
    navigator.vibrate(100)
  }

  console.log("Code barre détecté:", decodedText)

  // On arrête la caméra mais on garde l'overlay affiché pour le statut
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop()
  }

  scannerStatus.textContent = "✅ Code détecté ! Recherche du produit..."
  scannerContainer.classList.remove('hidden')

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`)
    const data = await response.json()

    if (data.status === 1 && data.product && data.product.product_name) {
      const productName = data.product.product_name
      const fullName = data.product.brands ? `${data.product.brands} - ${productName}` : productName
      const qty = newItemQuantity.value.trim()
      await insertItem(fullName, qty)
    } else {
      alert(`Produit non trouvé pour le code barre: ${decodedText}.\nTu peux le saisir manuellement.`)
      newItemInput.value = decodedText
    }
  } catch (err) {
    console.error("OpenFoodFacts error", err)
    alert("Erreur réseau lors de la recherche du produit.")
  } finally {
    isProcessingScan = false
    scannerStatus.textContent = "Vise le code-barres..."
    scannerContainer.classList.add('hidden')
    // Reset scanner instance for next use
    html5QrCode = null
  }
}


// --- Écouteurs globaux ---

function setupEventListeners() {
  authForm.addEventListener('submit', handleAuthSubmit)
  authToggleBtn.addEventListener('click', toggleAuthMode)
  logoutBtn.addEventListener('click', handleLogout)

  navList.addEventListener('click', () => {
    switchView('view-list')
    loadShoppingItems()
  })
  navShopping.addEventListener('click', () => {
    switchView('view-shopping')
    loadShoppingItems()
  })
  navProfile.addEventListener('click', () => switchView('view-profile'))
  createFamilyForm.addEventListener('submit', handleCreateFamily)
  clearCompletedBtn.addEventListener('click', archiveCompletedItems)
  if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', handleSaveTemplate)
  if (deleteTemplateBtn) deleteTemplateBtn.addEventListener('click', handleDeleteTemplate)
  applyTemplateBtn.addEventListener('click', handleApplyTemplate)

  // Suggestions personnalisées
  newItemInput.addEventListener('input', handleSuggestionInput)
  newItemInput.addEventListener('focus', handleSuggestionInput)
  // Fermer les suggestions si on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!newItemInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.classList.add('hidden')
    }
  })
}

// --- Listes Types (Templates) ---

async function loadTemplates() {
  if (!activeFamilyId) return

  const { data, error } = await supabase
    .from('list_templates')
    .select('*')
    .eq('family_id', activeFamilyId)
    .order('name')

  if (error) {
    console.error('Erreur chargement templates', error)
    return
  }

  templateSelect.innerHTML = '<option value="">Charger une liste...</option>' +
    data.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
}

async function handleSaveTemplate() {
  if (!activeFamilyId) return

  // 1. Récupérer les articles actifs
  const { data: items, error: fetchError } = await supabase
    .from('shopping_items')
    .select('name, quantity')
    .eq('family_id', activeFamilyId)
    .eq('is_archived', false)

  if (fetchError || !items || items.length === 0) {
    alert("La liste est vide ou inaccessible.")
    return
  }

  const selectedTemplateId = templateSelect.value
  let targetTemplateId = null
  let name = ""

  if (selectedTemplateId) {
    const confirmUpdate = confirm("Voulez-vous mettre à jour la liste type sélectionnée ?\n(Annuler pour en créer une nouvelle)")
    if (confirmUpdate) {
      targetTemplateId = selectedTemplateId
    }
  }

  if (!targetTemplateId) {
    name = prompt("Nom de cette nouvelle liste type (ex: Hebdo, Barbecue...) :")
    if (!name) return
  }

  try {
    if (!targetTemplateId) {
      // Créer le template
      const { data: template, error: tError } = await supabase
        .from('list_templates')
        .insert([{ family_id: activeFamilyId, name }])
        .select()
        .single()

      if (tError) throw tError
      targetTemplateId = template.id
    } else {
      // Mettre à jour : on vide d'abord les items existants
      const { error: deleteError } = await supabase
        .from('list_template_items')
        .delete()
        .eq('template_id', targetTemplateId)

      if (deleteError) throw deleteError
    }

    // Créer les items du template
    const templateItems = items.map(it => ({
      template_id: targetTemplateId,
      name: it.name,
      quantity: it.quantity
    }))

    const { error: itemsError } = await supabase
      .from('list_template_items')
      .insert(templateItems)

    if (itemsError) throw itemsError

    alert(targetTemplateId === selectedTemplateId ? "Liste type mise à jour !" : "Nouvelle liste type enregistrée !")
    loadTemplates()
  } catch (err) {
    console.error("Erreur sauvegarde template", err)
    alert("Un problème est survenu lors de l'enregistrement.")
  }
}

async function handleDeleteTemplate() {
  const templateId = templateSelect.value
  if (!templateId) {
    alert("Veuillez sélectionner une liste à supprimer.")
    return
  }

  const templateName = templateSelect.options[templateSelect.selectedIndex].text
  if (!confirm(`Voulez-vous vraiment supprimer la liste type "${templateName}" ?`)) return

  try {
    const { error } = await supabase
      .from('list_templates')
      .delete()
      .eq('id', templateId)

    if (error) throw error

    alert("Liste type supprimée.")
    loadTemplates()
  } catch (err) {
    console.error("Erreur suppression template", err)
    alert("Impossible de supprimer la liste type.")
  }
}

async function handleApplyTemplate() {
  const templateId = templateSelect.value
  if (!templateId) return

  if (!confirm("Voulez-vous remplacer votre liste actuelle par les articles de cette liste type ?")) return

  try {
    // 1. Archiver tous les articles actuels non archivés pour cette famille
    const { error: archiveError } = await supabase
      .from('shopping_items')
      .update({ is_archived: true })
      .eq('family_id', activeFamilyId)
      .eq('is_archived', false)

    if (archiveError) throw archiveError

    // 2. Récupérer les articles du template
    const { data: items, error: fetchError } = await supabase
      .from('list_template_items')
      .select('name, quantity')
      .eq('template_id', templateId)

    if (fetchError) throw fetchError

    // 3. On insère chaque article.
    for (const item of items) {
      await insertItem(item.name, item.quantity)
    }

    alert("Liste remplacée !")
    loadShoppingItems()
    loadSuggestions()
  } catch (err) {
    console.error("Erreur application template", err)
    alert("Impossible d'appliquer la liste type.")
  }
}

// Lancer l'app
init()
