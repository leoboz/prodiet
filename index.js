const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();
const port = 3000;

// Supabase setup with service_role key
const supabaseUrl = 'https://wixwwdmbigtgnrjfgxfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpeHd3ZG1iaWd0Z25yamZneGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzUxNTk2MCwiZXhwIjoyMDU5MDkxOTYwfQ.WpcahYpvhe-vW7K6RrjXqRo7WHGAjR1o6i3qWaRE3tM';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    console.log(`Serving static file: ${path}`);
  }
}));

// User registration endpoint (only creates the user)
app.post('/register', async (req, res) => {
  try {
    console.log('Received signup request:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      console.error('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign up user in Supabase Auth
    console.log('Attempting to sign up user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error('Auth Error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    console.log('User signed up successfully:', authData.user.id);
    const userId = authData.user.id;

    // Create a minimal profile in the users table
    console.log('Creating user profile in users table...');
    const { data, error } = await supabase
      .from('users')
      .insert([{ id: userId }])
      .select();

    if (error) {
      console.error('Insert Error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('User profile created successfully:', data);
    res.status(201).json({ user: authData.user });
  } catch (error) {
    console.error('Unexpected Error in /register:', error);
    res.status(500).json({ error: 'An unexpected error occurred during signup' });
  }
});

// User login endpoint
app.post('/login', async (req, res) => {
  try {
    console.log('Received login request:', req.body);
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login Error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('User logged in successfully:', data.user.id);
    res.status(200).json({ user: data.user, token: data.session.access_token });
  } catch (error) {
    console.error('Unexpected Error in /login:', error);
    res.status(500).json({ error: 'An unexpected error occurred during login' });
  }
});

// User logout endpoint
app.post('/logout', async (req, res) => {
  try {
    console.log('Received logout request');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout Error:', error);
      return res.status(400).json({ error: error.message });
    }
    console.log('User logged out successfully');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Unexpected Error in /logout:', error);
    res.status(500).json({ error: 'An unexpected error occurred during logout' });
  }
});

// Update user profile endpoint (handles all profile data and MBR calculation)
app.post('/update-profile', async (req, res) => {
  try {
    console.log('Received update-profile request:', req.body);
    const { userId, name, weight, height, gender, age, objective, preferences, restrictions } = req.body;

    if (!userId || !name || !weight || !height || !gender || !age) {
      console.error('Missing required fields:', { userId, name, weight, height, gender, age });
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    console.log('Checking if user exists in users table...');
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      console.error('Fetch User Error:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found:', existingUser);

    console.log('Calculating BMR...');
    let mbr;
    if (gender.toLowerCase() === 'male') {
      mbr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else if (gender.toLowerCase() === 'female') {
      mbr = 10 * weight + 6.25 * height - 5 * age - 161;
    } else {
      return res.status(400).json({ error: 'Gender must be "male" or "female"' });
    }

    console.log('Updating user profile...');
    const { data, error } = await supabase
      .from('users')
      .update({
        name,
        weight,
        height,
        gender,
        age,
        objective: objective || null,
        preferences: preferences || null,
        restrictions: restrictions || null,
        mbr
      })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Update Error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      console.error('No data returned from update');
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    console.log('Profile updated successfully:', data[0]);
    res.status(200).json(data[0]);
  } catch (error) {
    console.error('Unexpected Error in /update-profile:', error);
    res.status(500).json({ error: 'An unexpected error occurred during profile update' });
  }
});

app.post('/update-profile-photo', async (req, res) => {
  try {
    console.log('Received update-profile-photo request:', req.body);
    const { userId, photoUrl } = req.body;

    if (!userId || !photoUrl) {
      console.error('Missing userId or photoUrl');
      return res.status(400).json({ error: 'User ID and photo URL are required' });
    }

    console.log('Updating user photo URL for user:', userId);
    const { data, error } = await supabase
      .from('users')
      .update({ photo_url: photoUrl })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Update Error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      console.error('No data returned from update');
      return res.status(500).json({ error: 'Failed to update photo URL' });
    }

    console.log('Photo URL updated successfully:', data[0]);
    res.status(200).json(data[0]);
  } catch (error) {
    console.error('Unexpected Error in /update-profile-photo:', error);
    res.status(500).json({ error: 'An unexpected error occurred while updating photo URL' });
  }
});

app.get('/get-profile', async (req, res) => {
  try {
    console.log('Received get-profile request:', req.query);
    const { userId } = req.query;

    if (!userId) {
      console.error('Missing userId');
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Fetching profile for user:', userId);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!user) {
      console.error('User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Profile fetched successfully:', user);
    res.status(200).json(user);
  } catch (error) {
    console.error('Unexpected Error in /get-profile:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching the profile' });
  }
});

app.get('/get-foods', async (req, res) => {
  try {
    console.log('Fetching foods...');
    const { data, error } = await supabase
      .from('foods')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching foods:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Foods fetched successfully:', data);
    res.status(200).json(data);
  } catch (error) {
    console.error('Unexpected Error in /get-foods:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching foods' });
  }
});

app.get('/get-meal-types', async (req, res) => {
  try {
    console.log('Fetching meal types...');
    const { data, error } = await supabase
      .from('meal_types')
      .select('id, name, description')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching meal types:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Meal types fetched successfully:', data);
    res.status(200).json(data);
  } catch (error) {
    console.error('Unexpected Error in /get-meal-types:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching meal types' });
  }
});

app.post('/log-meal', async (req, res) => {
  try {
    console.log('Received log-meal request:', req.body);
    const { userId, mealTypeId, foodIds, foodQuantities, mealDate } = req.body;

    if (!userId || !mealTypeId || !foodIds || !foodQuantities || foodIds.length !== foodQuantities.length || !mealDate) {
      console.error('Invalid request data');
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Validate mealDate is not in the future
    const today = new Date().toISOString().split('T')[0];
    if (mealDate > today) {
      console.error('Cannot log meals for future dates');
      return res.status(400).json({ error: 'Cannot log meals for future dates' });
    }

    console.log('Fetching nutritional data for foods:', foodIds);
    const { data: foods, error: foodError } = await supabase
      .from('foods')
      .select('id, calories, protein, carbohydrates, fats')
      .in('id', foodIds);

    if (foodError) {
      console.error('Error fetching foods:', foodError);
      return res.status(400).json({ error: foodError.message });
    }

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;

    foodIds.forEach((foodId, index) => {
      const food = foods.find(f => f.id === foodId);
      const quantity = foodQuantities[index] / 1000;
      if (food) {
        totalCalories += (food.calories || 0) * quantity;
        totalProtein += (food.protein || 0) * quantity;
        totalCarbs += (food.carbohydrates || 0) * quantity;
        totalFats += (food.fats || 0) * quantity;
      }
    });

    console.log('Logging meal for user:', userId, 'on date:', mealDate);
    const { data, error } = await supabase
      .from('meal_records')
      .insert([{
        user_id: userId,
        meal_type_id: mealTypeId,
        food_ids: foodIds,
        food_quantities: foodQuantities,
        total_calories: totalCalories,
        protein: totalProtein,
        carbohydrates: totalCarbs,
        fats: totalFats,
        meal_date: mealDate // Store the selected date
      }])
      .select();

    if (error) {
      console.error('Error logging meal:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Meal logged successfully:', data);
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Unexpected Error in /log-meal:', error);
    res.status(500).json({ error: 'An unexpected error occurred while logging the meal' });
  }
});

app.get('/get-daily-meals', async (req, res) => {
  try {
    console.log('Received get-daily-meals request:', req.query);
    const { userId, date } = req.query;

    if (!userId || !date) {
      console.error('Missing userId or date');
      return res.status(400).json({ error: 'User ID and date are required' });
    }

    // Fetch meals for the specified date
    console.log('Fetching meals for user:', userId, 'on date:', date);
    const { data: meals, error } = await supabase
      .from('meal_records')
      .select('total_calories, protein, carbohydrates, fats')
      .eq('user_id', userId)
      .gte('meal_date', `${date}T00:00:00Z`)
      .lte('meal_date', `${date}T23:59:59Z`);

    if (error) {
      console.error('Error fetching meals:', error);
      return res.status(400).json({ error: error.message });
    }

    // Calculate totals
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;

    meals.forEach(meal => {
      totalCalories += meal.total_calories || 0;
      totalProtein += meal.protein || 0;
      totalCarbs += meal.carbohydrates || 0;
      totalFats += meal.fats || 0;
    });

    console.log('Daily totals calculated:', { totalCalories, totalProtein, totalCarbs, totalFats });
    res.status(200).json({
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFats
    });
  } catch (error) {
    console.error('Unexpected Error in /get-daily-meals:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching daily meals' });
  }
});

app.get('/get-meal-records', async (req, res) => {
  try {
    console.log('Received get-meal-records request:', req.query);
    const { userId, date } = req.query;

    if (!userId || !date) {
      console.error('Missing userId or date');
      return res.status(400).json({ error: 'User ID and date are required' });
    }

    console.log('Fetching meal records for user:', userId, 'on date:', date);
    const { data: meals, error } = await supabase
      .from('meal_records')
      .select('id, meal_type_id, food_ids, food_quantities, total_calories, protein, carbohydrates, fats')
      .eq('user_id', userId)
      .gte('meal_date', `${date}T00:00:00Z`)
      .lte('meal_date', `${date}T23:59:59Z`);

    if (error) {
      console.error('Error fetching meal records:', error);
      return res.status(400).json({ error: error.message });
    }

    const mealTypeIds = [...new Set(meals.map(meal => meal.meal_type_id))];
    const { data: mealTypes, error: mealTypeError } = await supabase
      .from('meal_types')
      .select('id, name')
      .in('id', mealTypeIds);

    if (mealTypeError) {
      console.error('Error fetching meal types:', mealTypeError);
      return res.status(400).json({ error: mealTypeError.message });
    }

    const allFoodIds = meals.flatMap(meal => meal.food_ids);
    const uniqueFoodIds = [...new Set(allFoodIds)];
    const { data: foods, error: foodError } = await supabase
      .from('foods')
      .select('id, name')
      .in('id', uniqueFoodIds);

    if (foodError) {
      console.error('Error fetching foods:', foodError);
      return res.status(400).json({ error: foodError.message });
    }

    const mealRecords = meals.map(meal => {
      const mealType = mealTypes.find(mt => mt.id === meal.meal_type_id);
      const foodNames = meal.food_ids.map(foodId => {
        const food = foods.find(f => f.id === foodId);
        return food ? food.name : 'Unknown';
      });

      return {
        id: meal.id,
        mealTypeId: meal.meal_type_id,
        mealTypeName: mealType ? mealType.name : 'Unknown',
        foodNames: foodNames,
        foodQuantities: meal.food_quantities,
        totalCalories: meal.total_calories || 0,
        protein: meal.protein || 0,
        carbohydrates: meal.carbohydrates || 0,
        fats: meal.fats || 0
      };
    });

    console.log('Meal records fetched successfully:', mealRecords);
    res.status(200).json(mealRecords);
  } catch (error) {
    console.error('Unexpected Error in /get-meal-records:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching meal records' });
  }
});

app.delete('/delete-meal/:id', async (req, res) => {
  try {
    console.log('Received delete-meal request:', req.params);
    const { id } = req.params;

    if (!id) {
      console.error('Missing meal ID');
      return res.status(400).json({ error: 'Meal ID is required' });
    }

    console.log('Deleting meal record:', id);
    const { error } = await supabase
      .from('meal_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting meal:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('Meal deleted successfully:', id);
    res.status(200).json({ message: 'Meal deleted successfully' });
  } catch (error) {
    console.error('Unexpected Error in /delete-meal:', error);
    res.status(500).json({ error: 'An unexpected error occurred while deleting the meal' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});