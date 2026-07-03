/**
 * server.js - Servidor Node/Express atualizado para exibir apenas POIs no mapa.
 * Inclui Passport (Local + Google), Cidades de JSON, endpoint /api/search para ChatGPT + Google Geocoding.
 */

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const db = require('./models');
const upload = require('./middleware/upload');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { generateTravelItinerary } = require('./services/aiService');
const { geocodeAddress } = require('./services/geocodingService');

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback';

if (!process.env.SESSION_SECRET) {
  throw new Error(
    'SESSION_SECRET is not defined. Por favor, defina um segredo de sessão nas suas variáveis de ambiente.'
  );
}

const app = express();

// Middleware de CORS e parsing JSON
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.json());

// Configuração de sessão
app.use(session({
  secret: process.env.SESSION_SECRET, // Segredo de sessão carregado das variáveis de ambiente
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Servir arquivos de uploads estáticos (se precisar)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===================================================== //
//   Carregar cidades de cities.json
// ===================================================== //
let citiesData = [];

fs.readFile("./data/cities.json", "utf8", (err, data) => {
  if (err) {
    console.error("Erro ao carregar o ficheiro JSON:", err);
  } else {
    try {
      citiesData = JSON.parse(data);
      console.log("JSON carregado com sucesso. Exemplo de dados:", citiesData.slice(0, 10));
    } catch (parseError) {
      console.error("Erro ao analisar o ficheiro JSON:", parseError);
    }
  }
});

// Endpoint para obter cidades por país
app.get("/api/cities", (req, res) => {
  const { countryCode } = req.query;

  console.log(`Recebida requisição para /api/cities com countryCode=${countryCode}`);

  if (!countryCode) {
    console.warn("Requisição /api/cities sem countryCode.");
    return res.status(400).json({ error: "O parâmetro 'countryCode' é obrigatório." });
  }

  // Filtrar cidades pelo código do país (ex.: "PT", "FR" etc.)
  const filteredCities = citiesData.filter(
    city => city.country.toUpperCase() === countryCode.toUpperCase()
  );

  if (filteredCities.length === 0) {
    console.warn(`Nenhuma cidade encontrada para o país ${countryCode}.`);
    return res.status(404).json({ message: `Nenhuma cidade encontrada para o país ${countryCode}.` });
  }

  console.log(`Encontradas ${filteredCities.length} cidades para o país ${countryCode}.`);
  res.json({ cities: filteredCities });
});

// ===================================================== //
//   Upload de Imagem de Perfil
// ===================================================== //
app.put('/api/user/profile/image', upload.single('profileImage'), async (req, res) => {
  try {
    console.log('Requisição recebida em /api/user/profile/image');

    if (!req.session.user) {
      console.warn('Usuário não autenticado tentando atualizar imagem de perfil.');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const user = await db.User.findOne({ where: { email: req.session.user.email } });
    if (!user) {
      console.warn('Usuário não encontrado ao tentar atualizar imagem de perfil.');
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!req.file) {
      console.warn('Nenhum arquivo enviado para atualizar imagem de perfil.');
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Salvar apenas o nome do arquivo da imagem enviada
    user.profileImage = req.file.filename;
    await user.save();

    // Atualizar sessão com a nova imagem de perfil
    req.session.user.profileImage = user.profileImage;

    console.log('Profile image updated.');
    res.json({
      message: 'Imagem de perfil atualizada com sucesso.',
      profileImage: user.profileImage
    });

  } catch (error) {
    console.error('Erro ao atualizar imagem de perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// ===================================================== //
//   Configurar Passport (Google OAuth)
// ===================================================== //
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await db.User.findOne({ where: { google_id: profile.id } });
        if (!user) {
          // Criar um novo usuário se não existir
          user = await db.User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            google_id: profile.id,
            google_token: accessToken,
            profileImage: null
          });
          console.log('New user created via Google OAuth.');
        } else {
          console.log('Existing user authenticated via Google OAuth.');
        }
        return done(null, user);
      } catch (err) {
        console.error('Erro no Google Strategy:', err);
        return done(err, null);
      }
    }
  )
);

// ===================================================== //
//   Atualizar perfil do usuário (Nome, Senha)
// ===================================================== //
app.put('/api/user/profile', async (req, res) => {
  try {
    console.log('Requisição recebida em /api/user/profile');

    if (!req.session.user) {
      console.warn('Usuário não autenticado tentando atualizar perfil.');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { name, password } = req.body;

    if (!name) {
      console.warn('Requisição /api/user/profile sem nome.');
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    const user = await db.User.findOne({ where: { email: req.session.user.email } });

    if (!user) {
      console.warn('Usuário não encontrado ao tentar atualizar perfil.');
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Atualizar o nome do usuário
    user.name = name;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Atualizar sessão com o novo nome
    req.session.user.name = user.name;
    if (user.profileImage) {
      req.session.user.profileImage = user.profileImage;
    }

    console.log('Profile updated.');
    res.json({ message: 'Perfil atualizado com sucesso.' });

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// ===================================================== //
//   Configurar Passport (Local Strategy)
// ===================================================== //
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const user = await db.User.findOne({ where: { email } });
        if (!user) {
          console.warn('User not found during local authentication.');
          return done(null, false, { message: 'Usuário não encontrado.' });
        }
        if (!user.password) {
          console.warn('Google-only account tried local authentication.');
          return done(null, false, {
            message: 'Usuário registrado via Google. Use login com Google.'
          });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.warn('Invalid password during local authentication.');
          return done(null, false, { message: 'Senha incorreta.' });
        }
        console.log('User authenticated successfully.');
        return done(null, user);
      } catch (err) {
        console.error('Erro no Local Strategy:', err);
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id); // Serializar o usuário pelo ID
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.User.findByPk(id); // Encontrar o usuário pelo ID
    done(null, user);
  } catch (err) {
    console.error('Erro ao deserializar usuário:', err);
    done(err, null);
  }
});

// ===================================================== //
//   Importar rotas (caso você tenha)
// ===================================================== //
const userRoutes = require('./routes/userRoutes');
const attractionRoutes = require('./routes/attractionRoutes');
const authRoutes = require('./routes/authRoutes');

app.use('/api/users', userRoutes);
app.use('/api/attractions', attractionRoutes);
app.use('/api', authRoutes);

// ===================================================== //
//   Rotas de OAuth do Google
// ===================================================== //
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    console.log('User authenticated via Google.');

    // Atualizar sessão com detalhes do usuário
    req.session.user = {
      name: req.user.name,
      email: req.user.email,
      profileImage: req.user.profileImage || null
    };

    console.log('Session updated after Google authentication.');
    res.redirect(`${FRONTEND_URL}/home_logged.html`);
  }
);

// ===================================================== //
//   Retornar usuário logado
// ===================================================== //
app.get('/api/user', (req, res) => {
  console.log('Requisição recebida em /api/user');

  if (!req.session.user) {
    console.warn('Usuário não autenticado tentando acessar /api/user.');
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  console.log('User session is authenticated.');
  res.json(req.session.user);
});

// ===================================================== //
//   Logout
// ===================================================== //
app.get('/logout', (req, res) => {
  console.log('Requisição recebida em /logout para usuário:', req.session.user ? req.session.user.email : 'Desconhecido');

  req.logout(err => {
    if (err) {
      console.error('Erro ao encerrar sessão:', err);
      return res.status(500).send('Erro ao encerrar sessão');
    }
    req.session.destroy(() => {
      console.log('Sessão encerrada para usuário:', req.session.user ? req.session.user.email : 'Desconhecido');
      res.redirect(FRONTEND_URL);
    });
  });
});

// ===================================================== //
//   Rota Root
// ===================================================== //
app.get('/', (req, res) => {
  res.send('Personalized Tourist Guide AI API is running.');
});

// ===================================================== //
//   Travel search endpoint
// ===================================================== //
app.post('/api/search', async (req, res) => {
  const {
    generalQuery,
    selectedCountries,
    selectedCities,
    selectedAttractions,
    selectedDays,
  } = req.body;

  if (
    !generalQuery ||
    !Array.isArray(selectedCountries) ||
    !Array.isArray(selectedCities) ||
    !Array.isArray(selectedAttractions) ||
    !selectedDays
  ) {
    return res.status(400).json({ error: 'Incomplete search data.' });
  }

  try {
    const aiResult = await generateTravelItinerary({
      generalQuery,
      selectedCountries,
      selectedCities,
      selectedAttractions,
      selectedDays,
    });

    const monumentsWithCoords = await Promise.all(
      aiResult.monuments.map(async (monument) => {
        const match = monument.match(/^(.*?)\s*\((.*)\)$/);

        if (!match) {
          return {
            name: monument,
            address: '',
            coordinates: null,
          };
        }

        const name = match[1].trim();
        const address = match[2].trim();
        const coordinates = await geocodeAddress(address);

        return {
          name,
          address,
          coordinates,
        };
      })
    );

    const validMonuments = monumentsWithCoords.filter(monument => monument.coordinates !== null);

    return res.json({
      provider: aiResult.provider,
      chatResponse: aiResult.rawContent,
      itinerary: aiResult.itinerary,
      monuments: validMonuments.length > 0 ? validMonuments : monumentsWithCoords,
    });
  } catch (error) {
    console.error('Error processing /api/search:', error.response ? error.response.data : error.message);
    return res.status(500).json({ error: 'Unable to process the travel search request.' });
  }
});

// Exemplo assumindo que você tem `db.FavoriteItinerary` configurado
// e que os dados de sessão do usuário estão em `req.session.user`.

app.post('/api/favorites', async (req, res) => {
  try {
    // Verificar se o usuário está logado (caso precise)
    if (!req.session.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Obter o user_id a partir da sessão (ou local do BD)
    const userEmail = req.session.user.email;  
    const dbUser = await db.User.findOne({ where: { email: userEmail } });
    if (!dbUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userId = dbUser.id;

    // Ler o body com as infos do itinerário
    const { name, itinerary, map_data } = req.body;

    // Verificar se já existe um favorito igual (opcional)
    // Se quiser permitir múltiplos favoritos “iguais”, tudo bem. Caso queira
    // evitar duplicados, você poderia buscar se existe já esse "name" p/ user.
    // Exemplo (opcional):
    // const existing = await db.FavoriteItinerary.findOne({ where: { user_id: userId, name } });
    // if (existing) {
    //   return res.status(400).json({ error: 'Já existe um favorito com este nome.' });
    // }

    // Criar registro
    const newFavorite = await db.FavoriteItinerary.create({
      user_id: userId,
      name: name || 'Sem título',
      itinerary: itinerary,   // => JSONB
      map_data: map_data      // => JSONB
    });

    return res.json({
      message: 'Favorito salvo com sucesso!',
      favoriteId: newFavorite.id
    });
  } catch (error) {
    console.error("Erro ao salvar favorito:", error);
    return res.status(500).json({ error: 'Erro interno ao salvar favorito.' });
  }
});


app.delete('/api/favorites/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userEmail = req.session.user.email;  
    const dbUser = await db.User.findOne({ where: { email: userEmail } });
    if (!dbUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userId = dbUser.id;

    const favoriteId = req.params.id;

    // Verificar se esse favorito pertence mesmo ao usuário
    const favorite = await db.FavoriteItinerary.findOne({
      where: { id: favoriteId, user_id: userId }
    });

    if (!favorite) {
      return res.status(404).json({ error: 'Favorito não encontrado ou não pertence a este usuário.' });
    }

    // Excluir
    await favorite.destroy();

    return res.json({ message: 'Favorito removido com sucesso!' });
  } catch (error) {
    console.error("Erro ao remover favorito:", error);
    return res.status(500).json({ error: 'Erro interno ao remover favorito.' });
  }
});


app.get('/api/favorites', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userEmail = req.session.user.email;  
    const dbUser = await db.User.findOne({ where: { email: userEmail } });
    if (!dbUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userId = dbUser.id;

    // Buscar todos os favoritos
    const favorites = await db.FavoriteItinerary.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']]
    });

    return res.json(favorites);  // Retorna array com todos os favoritos
  } catch (error) {
    console.error("Erro ao listar favoritos:", error);
    return res.status(500).json({ error: 'Erro interno ao listar favoritos.' });
  }
});

// Exemplo de endpoint POST para salvar/atualizar a pesquisa recente
app.post('/api/recent_search', async (req, res) => {
  try {
    // Verifica se o usuário está autenticado (assumindo que os dados estão na sessão)
    if (!req.session.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    // Busca o usuário no banco de dados pelo email da sessão
    const userEmail = req.session.user.email;  
    const dbUser = await db.User.findOne({ where: { email: userEmail } });
    if (!dbUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userId = dbUser.id;

    // Espera os dados da pesquisa recente no body: query_params (dados dos filtros),
    // itinerary, monuments, directions
    const { query_params, itinerary, monuments, directions } = req.body;
    if (!query_params) {
      return res.status(400).json({ error: 'query_params são obrigatórios.' });
    }

    // Procura se já existe uma pesquisa recente para este usuário
    let recentSearch = await db.RecentSearches.findOne({ where: { user_id: userId } });

    if (recentSearch) {
      // Atualiza o registro existente
      recentSearch.query_params = query_params;
      recentSearch.itinerary = itinerary;
      recentSearch.monuments = monuments;
      recentSearch.directions = directions;
      recentSearch.updated_at = new Date();
      await recentSearch.save();
    } else {
      // Cria um novo registro se não existir nenhum
      recentSearch = await db.RecentSearches.create({
        user_id: userId,
        query_params,
        itinerary,
        monuments,
        directions
      });
    }

    return res.json({
      message: 'Pesquisa recente salva/atualizada com sucesso.',
      recentSearchId: recentSearch.id
    });
  } catch (error) {
    console.error("Erro ao salvar pesquisa recente:", error);
    return res.status(500).json({ error: 'Erro interno ao salvar pesquisa recente.' });
  }
});

// Exemplo de endpoint GET para recuperar a pesquisa recente
app.get('/api/recent_search', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    const userEmail = req.session.user.email;  
    const dbUser = await db.User.findOne({ where: { email: userEmail } });
    if (!dbUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userId = dbUser.id;

    // Recupera a pesquisa recente deste usuário
    const recentSearch = await db.RecentSearches.findOne({
      where: { user_id: userId },
      order: [['updated_at', 'DESC']]
    });
    if (!recentSearch) {
      return res.status(404).json({ message: 'Nenhuma pesquisa recente encontrada.' });
    }
    return res.json(recentSearch);
  } catch (error) {
    console.error("Erro ao recuperar pesquisa recente:", error);
    return res.status(500).json({ error: 'Erro interno ao recuperar pesquisa recente.' });
  }
});

app.get('/api/favorites/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const favoriteId = req.params.id;
    const userEmail = req.session.user.email;  
    const dbUser = await db.User.findOne({ where: { email: userEmail } });
    if (!dbUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userId = dbUser.id;

    const favorite = await db.FavoriteItinerary.findOne({
      where: { id: favoriteId, user_id: userId }
    });

    if (!favorite) {
      return res.status(404).json({ error: 'Favorito não encontrado ou não pertence a este usuário.' });
    }

    // Retornar o favorito
    return res.json(favorite);
  } catch (error) {
    console.error("Erro ao obter favorito por ID:", error);
    res.status(500).json({ error: 'Erro interno ao obter favorito.' });
  }
});


// ===================================================== //
//   Porta de escuta
// ===================================================== //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor está rodando na porta ${PORT}`);
});
