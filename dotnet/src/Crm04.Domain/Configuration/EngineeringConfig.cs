namespace Crm04.Domain.Configuration;

/// <summary>
/// ENGINEERING CONFIGURATION - §8 of the master spec. Port of <c>src/config/engineeringConfig.ts</c>.
///
/// EVERY coefficient used by any equation in the twin lives here. There are no magic numbers in
/// the model files: if a number influences a physical result, it is declared here with its unit,
/// its source and its limitation.
///
/// IMPORTANT (§19.6): these are SIMPLIFIED TEXTBOOK RELATIONS chosen so the twin is internally
/// consistent. They are NOT the mill's technology model.
///
/// A NOTE ON THE PORT. Every coefficient below is live. The material, friction and solver
/// constants are read by <see cref="Crm04.Domain.Simulation.RollingModel"/>,
/// <see cref="Crm04.Domain.Simulation.ForceModel"/> and
/// <see cref="Crm04.Domain.Simulation.ThicknessModel"/>; the limits are read by the tag catalogue
/// and the alarm engine; the whole object is displayed by the plant-config page. A value changed
/// here therefore moves the physics, the alarm thresholds and the displayed configuration
/// together, which is the point of having one file.
///
/// This is a static class rather than a deserialised options object because several members are
/// DERIVED at initialisation from <see cref="MillConfig"/> - see
/// <see cref="HydraulicPressureAtMaxForce"/> and <see cref="ForceLimits"/>. A POCO bound from
/// appsettings would let those drift out of step with the mill they are derived from.
/// </summary>
public static class EngineeringConfig
{
    private static readonly MillRatings Ratings = MillConfig.Default.Ratings;

    /// <summary>
    /// Steel density, kg/m³ - used only for coil mass and inertia display. Standard value for
    /// low-carbon steel; not a tuning parameter.
    /// </summary>
    public const double SteelDensity = 7850d;

    /// <summary>Standard gravity, m/s² - for the t ↔ kN conversion.</summary>
    public const double Gravity = 9.80665d;

    /// <summary>
    /// kgf -&gt; kN. The FPE manual states every tension in kgf (§1.4). This is the single point
    /// where those become the kN the rest of the twin works in.
    /// </summary>
    public static double KgfToKn(double kgf) => kgf * Gravity / 1000d;

    // -------------------------------------------------------------------------------------
    // Material and roll-bite coefficients
    // -------------------------------------------------------------------------------------

    /// <summary>
    /// Base deformation resistance (mean flow stress at zero strain), MPa. Low-carbon
    /// cold-rolling grade, annealed hot band; 450 MPa is representative before hardening.
    /// LIMITATION: a single scalar cannot represent a grade family.
    /// </summary>
    public const double MaterialFactor = 450d;

    /// <summary>
    /// Strain-hardening multiplier C in kf = kf0·(1 + C·ε)^n. A Ludwik-type fit for low-carbon
    /// steel over 0 &lt; ε &lt; 1.4. LIMITATION: fitted shape only, not a measured curve.
    /// </summary>
    public const double HardeningCoefficient = 8.0d;

    /// <summary>Strain-hardening exponent n, dimensionless.</summary>
    public const double HardeningExponent = 0.22d;

    /// <summary>
    /// Coulomb friction coefficient µ in the roll bite. 0.045 is typical for cold rolling with
    /// a rolling-oil emulsion. LIMITATION: friction actually varies with speed, emulsion
    /// concentration and roll roughness; here it is a constant.
    /// </summary>
    public const double FrictionFactor = 0.045d;

    /// <summary>Mechanical efficiency of the drive train, 0..1.</summary>
    public const double MechanicalEfficiency = 0.92d;

    /// <summary>Mill modulus M, t/mm - the gaugemeter spring constant (§8.1).</summary>
    public static readonly double MillModulus = Ratings.MillModulus;

    /// <summary>Young's modulus of the roll material, MPa. Forged steel work roll.</summary>
    public const double RollYoungsModulus = 210_000d;

    /// <summary>Poisson ratio of the roll material, dimensionless.</summary>
    public const double RollPoissonRatio = 0.3d;

    /// <summary>
    /// Lever-arm ratio a/L for cold rolling torque. In cold rolling the resultant acts between
    /// the neutral point and the exit; 0.4-0.5 is the accepted band. LIMITATION: constant,
    /// whereas the true lever arm shifts with friction hill shape.
    /// </summary>
    public const double LeverArmRatio = 0.45d;

    /// <summary>
    /// Forward slip f at the roll exit: v_exit = v_roll·(1+f). Keeps roll surface speed and
    /// strip exit speed mutually consistent so mass flow closes. LIMITATION: f actually depends
    /// on reduction, friction and tension; a constant is a deliberate simplification.
    /// </summary>
    public const double ForwardSlip = 0.03d;

    /// <summary>2/√3 - plane-strain (von Mises) constraint factor.</summary>
    public const double PlaneStrainFactor = 1.1547d;

    /// <summary>
    /// Roll flattening and force are mutually dependent, and on thin strip the fixed point
    /// converges slowly (R' can reach 2× nominal). Three iterations under-predicts force by
    /// 15-20% on a light pass; eight converges to well inside 1 t on the whole schedule.
    /// </summary>
    public const int HitchcockIterations = 8;

    /// <summary>Convergence tolerance on the flattened radius, mm.</summary>
    public const double HitchcockToleranceMm = 0.01d;

    // -------------------------------------------------------------------------------------
    // Limits. DERIVED from the mill ratings - the alarm engine and the tag catalogue both
    // read these, so they must move when the mill rating moves.
    // -------------------------------------------------------------------------------------

    public static readonly ForceLimitSet ForceLimits = new(
        Warning: Ratings.MaxRollingForce * 0.8d,
        Alarm: Ratings.MaxRollingForce * 0.92d,
        Trip: Ratings.MaxRollingForce);

    public static readonly MotorLimitSet MotorLimits = new(
        CurrentMax: Ratings.MainDriveRatedCurrent,
        PowerMax: Ratings.MainDriveRating,
        TorqueMax: Ratings.MainDriveRatedTorque);

    /// <summary>
    /// Tension limits in kN, converted here - and only here - from the kgf figures the FPE
    /// manual states (§1.4): 6900 kg maximum up to 350 m/min, 690 kg minimum. Both tension reels
    /// are identical machines, so entry and exit share one envelope; which of them is currently
    /// "entry" is a role, not a rating.
    ///
    /// This is a NARROW mill with modest tension capability. 67.7 kN over a 450 × 2.8 mm section
    /// is only ~54 N/mm², so the early passes run at low specific tension and absorb the
    /// difference as force. That is a real constraint of the machine, not a modelling convenience.
    /// </summary>
    public static readonly TensionLimitSet TensionLimits = new(
        EntryMin: KgfToKn(Ratings.ReelTensionMinKg),
        EntryMax: KgfToKn(Ratings.ReelTensionMaxKg),
        ExitMin: KgfToKn(Ratings.ReelTensionMinKg),
        ExitMax: KgfToKn(Ratings.ReelTensionMaxKg));

    public static readonly SpeedLimitSet SpeedLimits = new(
        Max: Ratings.MaxMillSpeed,
        ThreadingSpeed: Ratings.ThreadingSpeed);

    /// <summary>Specific tension envelope, N/mm² - used to validate schedule entries.</summary>
    public static readonly SpecificTensionLimitSet SpecificTensionLimits = new(Min: 10d, Max: 180d);

    /// <summary>Thickness tolerance, µm (±).</summary>
    public static readonly double ThicknessTolerance = Ratings.ThicknessToleranceUm;

    /// <summary>
    /// X-ray gauge noise, 1σ in µm. Chosen so a healthy AGC keeps the displayed gauge signal
    /// inside the ±5 µm target while still showing realistic instrument scatter. LIMITATION:
    /// white noise only - real X-ray gauges also drift and alias with strip flutter.
    /// </summary>
    public const double GaugeNoiseSigma = 1.1d;

    // -------------------------------------------------------------------------------------
    // Motion and control
    // -------------------------------------------------------------------------------------

    /// <summary>Mill acceleration, m/min per second.</summary>
    public const double Acceleration = 55d;

    /// <summary>Normal deceleration, m/min per second.</summary>
    public const double Deceleration = 70d;

    /// <summary>Fast-stop deceleration, m/min per second.</summary>
    public const double FastStopDeceleration = 260d;

    /// <summary>HAGC actuator slew rate, mm/s.</summary>
    public const double HagcSlewRate = 4.0d;

    /// <summary>
    /// HAGC proportional gain, mm of S0 per mm of thickness error. LIMITATION: the real HAGC is
    /// a cascaded position/pressure loop at 100 Hz+ with mass-flow and feed-forward trims; this
    /// is a single PI on thickness.
    /// </summary>
    public const double HagcGainP = 0.55d;

    /// <summary>HAGC integral gain, mm of S0 per mm·s of thickness error.</summary>
    public const double HagcGainI = 0.9d;

    /// <summary>Tension loop first-order time constant, s.</summary>
    public const double TensionTimeConstant = 0.55d;

    // -------------------------------------------------------------------------------------
    // Hydraulics. DERIVED from the actual cylinder, not guessed.
    // -------------------------------------------------------------------------------------

    /// <summary>
    /// Ram area of both roll-force cylinders, cm². §6.2, Table I item 19: ram type, Ø420, one
    /// per housing.
    /// </summary>
    private static readonly double RollForceRamAreaCm2 =
        2d * (Math.PI / 4d) * Math.Pow(Ratings.RollForceCylinderBore / 10d, 2d);

    /// <summary>
    /// Loading pressure at the mill's rated force, bar. Computed from the real cylinder geometry
    /// so the hydraulic readout and the force readout are the same physical statement rather
    /// than two independently tuned numbers.
    ///
    ///   p = F / (2 · πD²/4) = 360 000 kgf / (2 · 1385.4 cm²) = 130 kg/cm² ≈ 127 bar
    ///
    /// which sits comfortably inside the manual's 210 kg/cm² working limit - as it must, since
    /// the rating is set by the stand, not by the hydraulics. 1 kg/cm² = 0.980665 bar.
    /// </summary>
    public static readonly double HydraulicPressureAtMaxForce =
        Ratings.MaxRollingForce * 1000d / RollForceRamAreaCm2 * 0.980665d;

    /// <summary>Low-pressure alarm limit, bar - the same proportion of full load as the original.</summary>
    public static readonly double HydraulicPressureMin =
        Math.Round(HydraulicPressureAtMaxForce * 0.32d, MidpointRounding.AwayFromZero);

    /// <summary>Low-pressure lubrication system nominal pressure, bar.</summary>
    public const double LpSystemPressure = 4.5d;

    // -------------------------------------------------------------------------------------
    // Timing
    // -------------------------------------------------------------------------------------

    /// <summary>Frame considered stale after this many ms without an update (§14.5).</summary>
    public const int StaleAfterMs = 3000;

    /// <summary>
    /// Frame period, ms. 10 Hz - one of the publish rates §14.2 asks the twin to work at, and a
    /// realistic edge-gateway rate. In the .NET topology this is the Feeder's write period and
    /// the API's target publish rate. The scene stays continuous at this rate because every
    /// visual value is damped in the twin engine (§10.4), the same mechanism that will carry the
    /// 0.2 Hz historian replay case.
    /// </summary>
    public const int FrameTickMs = 100;

    /// <summary>UI/telemetry sampling period, ms - decoupled from the 3D frame loop (§15). 4 Hz.</summary>
    public const int TelemetrySampleMs = 250;

    /// <summary>Chart repaint period, ms - throttled independently of the 3D loop (§12). 2 Hz.</summary>
    public const int ChartRefreshMs = 500;

    /// <summary>Fixed-point solver settings for the coupled gaugemeter/force problem.</summary>
    public static readonly SolverSettings Solver = new(MaxIterations: 12, ToleranceMm: 1e-5d, Relaxation: 0.6d);
}

/// <param name="Warning">80% of rated force.</param>
/// <param name="Alarm">92% of rated force.</param>
/// <param name="Trip">Rated force.</param>
public readonly record struct ForceLimitSet(double Warning, double Alarm, double Trip);

public readonly record struct MotorLimitSet(double CurrentMax, double PowerMax, double TorqueMax);

public readonly record struct TensionLimitSet(double EntryMin, double EntryMax, double ExitMin, double ExitMax);

public readonly record struct SpeedLimitSet(double Max, double ThreadingSpeed);

public readonly record struct SpecificTensionLimitSet(double Min, double Max);

public readonly record struct SolverSettings(int MaxIterations, double ToleranceMm, double Relaxation);
